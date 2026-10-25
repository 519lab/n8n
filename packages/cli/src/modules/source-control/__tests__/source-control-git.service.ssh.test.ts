import type { Logger } from '@n8n/backend-common';
import type { SettingsRepository } from '@n8n/db';
import type { Cipher } from 'n8n-core';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { mock } from 'vitest-mock-extended';

import { SourceControlGitService } from '../source-control-git.service';
import type { SourceControlPreferences } from '../types/source-control-preferences';

describe('SourceControlGitService with an SSH remote', () => {
	let workDir: string;

	beforeEach(async () => {
		workDir = await mkdtemp(path.join(tmpdir(), 'n8n-source-control-'));
	});

	afterEach(async () => {
		await rm(workDir, { recursive: true, force: true });
	});

	it('runs git with the instance GIT_SSH_COMMAND instead of refusing it', async () => {
		const logger = mock<Logger>();
		logger.scoped.mockReturnValue(logger);
		const cipher = mock<Cipher>();
		cipher.decryptWithInstanceKey.mockReturnValue('-----BEGIN OPENSSH PRIVATE KEY-----\n');
		const settingsRepository = mock<SettingsRepository>();
		settingsRepository.findByKey.mockResolvedValue({
			key: 'features.sourceControl.sshKeys',
			value: JSON.stringify({ encryptedPrivateKey: 'encrypted', publicKey: 'ssh-ed25519 AAAA' }),
			loadOnStartup: true,
		});

		const service = new SourceControlGitService(logger, cipher, settingsRepository);
		await service.initService({
			sourceControlPreferences: mock<SourceControlPreferences>({
				repositoryUrl: 'git@git.example.com:acme/workflows.git',
			}),
			gitFolder: path.join(workDir, 'git'),
			sshFolder: path.join(workDir, 'ssh'),
		});

		await service.initRepository(
			{ repositoryUrl: 'git@git.example.com:acme/workflows.git', branchName: 'main' },
			{ firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' },
		);

		await expect(service.status()).resolves.toMatchObject({ files: [] });

		// git itself sees the instance key in its effective SSH command.
		const git = (service as unknown as { getGit(): import('simple-git').SimpleGit }).getGit();
		const sshCommand = await git.raw(['config', '--get', 'core.sshCommand']);
		expect(sshCommand).toContain('IdentitiesOnly=yes');
		expect(sshCommand).toContain(path.join(workDir, 'ssh'));
	});
});
