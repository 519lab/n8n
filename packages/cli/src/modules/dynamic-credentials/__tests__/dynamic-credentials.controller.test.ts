import type { AuthenticatedRequest, User } from '@n8n/db';
import type { Response } from 'express';
import { mock } from 'vitest-mock-extended';

import type { AuthService } from '@/auth/auth.service';
import { BadRequestError } from '@/errors/response-errors/bad-request.error';
import { UnauthenticatedError } from '@/errors/response-errors/unauthenticated.error';

import type { DynamicCredentialsConfig } from '../dynamic-credentials.config';
import { DynamicCredentialsController } from '../dynamic-credentials.controller';
import type { DynamicCredentialAuthorizationService } from '../services/dynamic-credential-authorization.service';

const ENDPOINT_TOKEN = 'static-endpoint-token';
const user = mock<User>({ id: 'user-1' });

const setup = (endpointAuthToken = ENDPOINT_TOKEN) => {
	const config = mock<DynamicCredentialsConfig>({ endpointAuthToken });
	const authService = mock<AuthService>();
	authService.getCookieToken.mockReturnValue('cookie-jwt');
	const service = mock<DynamicCredentialAuthorizationService>();
	const controller = new DynamicCredentialsController(config, authService, service);
	return { controller, service };
};

const request = ({
	withSession = false,
	headers = {},
}: { withSession?: boolean; headers?: Record<string, string> }) =>
	({ user: withSession ? user : undefined, headers, query: {} }) as unknown as AuthenticatedRequest;

const res = mock<Response>();

describe('DynamicCredentialsController', () => {
	describe('admission', () => {
		it('rejects a request with neither a session nor the endpoint token', async () => {
			const { controller, service } = setup();

			await expect(
				controller.getExecutionStatus(
					request({ headers: { authorization: 'Bearer x' } }),
					res,
					'wf',
					{},
				),
			).rejects.toThrow(UnauthenticatedError);
			expect(service.getExecutionStatus).not.toHaveBeenCalled();
		});

		it('rejects a wrong endpoint token', async () => {
			const { controller } = setup();

			await expect(
				controller.getExecutionStatus(
					request({ headers: { 'x-authorization': 'wrong-token', authorization: 'Bearer x' } }),
					res,
					'wf',
					{},
				),
			).rejects.toThrow(UnauthenticatedError);
		});

		it('admits no external caller when no endpoint token is configured', async () => {
			const { controller } = setup('');

			await expect(
				controller.getExecutionStatus(
					request({ headers: { 'x-authorization': '', authorization: 'Bearer x' } }),
					res,
					'wf',
					{},
				),
			).rejects.toThrow(UnauthenticatedError);
		});
	});

	describe('identity', () => {
		it('acts for the external user named by the Bearer when the endpoint token is valid', async () => {
			const { controller, service } = setup();

			await controller.getExecutionStatus(
				request({ headers: { 'x-authorization': ENDPOINT_TOKEN, authorization: 'Bearer ext' } }),
				res,
				'wf',
				{},
			);

			expect(service.getExecutionStatus).toHaveBeenCalledWith('wf', {
				kind: 'external',
				authorizationHeader: 'Bearer ext',
			});
		});

		it('acts for the session user when authSource=cookie, even if a Bearer is sent', async () => {
			const { controller, service } = setup();

			await controller.getExecutionStatus(
				request({ withSession: true, headers: { authorization: 'Bearer ext' } }),
				res,
				'wf',
				{ authSource: 'cookie' },
			);

			expect(service.getExecutionStatus).toHaveBeenCalledWith('wf', {
				kind: 'user',
				user,
				cookieToken: 'cookie-jwt',
			});
		});

		it('refuses authSource=cookie without a session', async () => {
			const { controller } = setup();

			await expect(
				controller.getExecutionStatus(
					request({ headers: { 'x-authorization': ENDPOINT_TOKEN } }),
					res,
					'wf',
					{ authSource: 'cookie' },
				),
			).rejects.toThrow(UnauthenticatedError);
		});

		it('refuses a non-Bearer Authorization header as an external identity', async () => {
			const { controller } = setup();

			await expect(
				controller.getExecutionStatus(
					request({ headers: { 'x-authorization': ENDPOINT_TOKEN, authorization: 'Basic abc' } }),
					res,
					'wf',
					{},
				),
			).rejects.toThrow(UnauthenticatedError);
		});
	});

	it('requires a resolverId to authorize or revoke', async () => {
		const { controller } = setup();
		const req = request({ withSession: true });

		await expect(controller.authorize(req, res, 'cred', {})).rejects.toThrow(BadRequestError);
		await expect(controller.revoke(req, res, 'cred', {})).rejects.toThrow(BadRequestError);
	});

	it('requires a token to follow an authorize link', async () => {
		const { controller } = setup();

		await expect(controller.followAuthorizeLink(request({}), res, 'cred', {})).rejects.toThrow(
			BadRequestError,
		);
	});
});
