import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { BeethovenTarget } from './cmakeParser';

/**
 * Handles regeneration of beethoven_hardware.h from Scala sources.
 */
export class HeaderGenerator implements vscode.Disposable {
    private outputChannel: vscode.OutputChannel;
    private isGenerating = false;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Beethoven Header Generation');
    }

    /**
     * Regenerate C++ headers for a specific target
     */
    public async regenerateTarget(target: BeethovenTarget, hardwarePath: string): Promise<boolean> {
        if (this.isGenerating) {
            vscode.window.showWarningMessage('Header generation already in progress');
            return false;
        }

        this.isGenerating = true;
        this.outputChannel.show(true);
        this.outputChannel.appendLine('='.repeat(60));
        this.outputChannel.appendLine(`Regenerating: ${target.name}`);
        this.outputChannel.appendLine(`  Main class: ${target.mainClass}`);
        this.outputChannel.appendLine(`  Output: ${target.outputDir}`);
        this.outputChannel.appendLine('='.repeat(60));

        // Ensure output directory exists
        fs.mkdirSync(target.outputDir, { recursive: true });

        try {
            return await this.runSbt(target, hardwarePath);
        } finally {
            this.isGenerating = false;
        }
    }

    /**
     * Regenerate headers for all targets
     */
    public async regenerateAll(targets: BeethovenTarget[], hardwarePath: string): Promise<void> {
        for (const target of targets) {
            await this.regenerateTarget(target, hardwarePath);
        }
    }

    /**
     * Run header generation using sbt
     */
    private async runSbt(target: BeethovenTarget, hardwarePath: string): Promise<boolean> {
        return new Promise((resolve) => {
            const env = {
                ...process.env,
                BEETHOVEN_PATH: target.outputDir
            };

            this.outputChannel.appendLine(`trying command: sbt "runMain ${target.mainClass}"`);
            this.outputChannel.appendLine(`$ cd ${hardwarePath}`);
            this.outputChannel.appendLine(`$ BEETHOVEN_PATH=${target.outputDir}`);
            const runstr = `runMain ${target.mainClass}`
            const proc = spawn("sbt", [runstr], {
                cwd: hardwarePath,
                env: env,
                shell: false
            });

            proc.stdout?.on('data', (data) => {
                this.outputChannel.append(data.toString());
            });

            proc.stderr?.on('data', (data) => {
                this.outputChannel.append(data.toString());
            });

            proc.on('close', (code) => {
                if (code === 0) {
                    this.outputChannel.appendLine(`\n[${target.name}] Header generation completed`);
                    resolve(true);
                } else {
                    this.outputChannel.appendLine(`\n[${target.name}] sbt exited with code ${code}`);
                    vscode.window.showErrorMessage(`Beethoven: Header generation failed for ${target.name}`);
                    resolve(false);
                }
            });

            proc.on('error', (err) => {
                this.outputChannel.appendLine(`Error: ${err.message}`);
                vscode.window.showErrorMessage(`Beethoven: ${err.message}`);
                resolve(false);
            });
        });
    }

    /**
     * Find the Beethoven-Hardware directory
     */
    public findHardwarePath(workspaceRoot: string): string | undefined {
        const possiblePaths = [
            path.join(workspaceRoot, 'Beethoven-Hardware'),
            path.join(workspaceRoot, '..', 'Beethoven-Hardware'),
            workspaceRoot
        ];

        for (const p of possiblePaths) {
            if (fs.existsSync(path.join(p, 'build.sbt'))) {
                return p;
            }
        }

        return undefined;
    }

    public dispose(): void {
        this.outputChannel.dispose();
    }
}
