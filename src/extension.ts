import * as vscode from 'vscode';
import { CMakeParser, BeethovenTarget } from './cmakeParser';
import { HeaderGenerator } from './headerGenerator';

let cmakeParser: CMakeParser | undefined;
let headerGenerator: HeaderGenerator | undefined;
let statusBarItem: vscode.StatusBarItem | undefined;
let targets: BeethovenTarget[] = [];
let fileWatcher: vscode.FileSystemWatcher | undefined;

export async function activate(context: vscode.ExtensionContext) {
    console.log('[Beethoven] Extension activating...');

    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
        console.log('[Beethoven] No workspace folder found');
        return;
    }

    // Initialize components
    cmakeParser = new CMakeParser();
    headerGenerator = new HeaderGenerator();

    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        100
    );
    statusBarItem.text = '$(chip) Beethoven';
    statusBarItem.tooltip = 'Beethoven Hardware-Software Bridge';
    statusBarItem.command = 'beethoven.showTargets';
    statusBarItem.show();

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('beethoven.regenerateHeaders', async () => {
            await regenerateAll(workspaceRoot);
        }),

        vscode.commands.registerCommand('beethoven.refreshTargets', async () => {
            await refreshTargets(workspaceRoot);
        }),

        vscode.commands.registerCommand('beethoven.showTargets', () => {
            showTargets();
        })
    );

    // Watch for Scala file saves
    fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.scala');
    fileWatcher.onDidChange(async () => {
        const config = vscode.workspace.getConfiguration('beethoven');
        if (config.get<boolean>('autoRegenerate', true)) {
            await regenerateAll(workspaceRoot);
        }
    });

    // Also watch CMakeLists.txt for changes to refresh targets
    const cmakeWatcher = vscode.workspace.createFileSystemWatcher('**/CMakeLists.txt');
    cmakeWatcher.onDidChange(async () => {
        await refreshTargets(workspaceRoot);
    });

    // Initial setup - find targets from CMakeLists.txt
    await refreshTargets(workspaceRoot);

    // Register disposables
    context.subscriptions.push(
        headerGenerator,
        statusBarItem,
        fileWatcher,
        cmakeWatcher
    );

    console.log('[Beethoven] Extension activated');
}

export function deactivate() {
    console.log('[Beethoven] Extension deactivating...');
}

/**
 * Get the workspace root folder
 */
function getWorkspaceRoot(): string | undefined {
    const folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length > 0) {
        return folders[0].uri.fsPath;
    }
    return undefined;
}

/**
 * Refresh the list of beethoven_hardware() targets from CMakeLists.txt
 */
async function refreshTargets(workspaceRoot: string): Promise<void> {
    targets = await cmakeParser!.findTargets(workspaceRoot);

    if (targets.length > 0) {
        statusBarItem!.text = `$(chip) Beethoven (${targets.length} targets)`;
        statusBarItem!.tooltip = `Click to see ${targets.length} Beethoven targets`;
        console.log(`[Beethoven] Found ${targets.length} targets`);
    } else {
        statusBarItem!.text = '$(chip) Beethoven (no targets)';
        statusBarItem!.tooltip = 'No beethoven_hardware() calls found in CMakeLists.txt';
    }
}

/**
 * Regenerate headers for all discovered targets
 */
async function regenerateAll(workspaceRoot: string): Promise<void> {
    if (targets.length === 0) {
        vscode.window.showWarningMessage('Beethoven: No targets found. Add beethoven_hardware() to CMakeLists.txt');
        return;
    }

    // Find Beethoven-Hardware path
    const hardwarePath = headerGenerator!.findHardwarePath(workspaceRoot);
    if (!hardwarePath) {
        vscode.window.showErrorMessage(
            'Beethoven: Could not find Beethoven-Hardware directory. ' +
            'Ensure build.sbt exists in Beethoven-Hardware/'
        );
        return;
    }

    // Update status bar
    statusBarItem!.text = '$(sync~spin) Beethoven';
    statusBarItem!.tooltip = 'Regenerating C++ headers...';

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Beethoven: Regenerating headers',
        cancellable: false
    }, async (progress) => {
        const total = targets.length;
        let completed = 0;

        for (const target of targets) {
            progress.report({
                message: `${target.name} (${completed + 1}/${total})`,
                increment: (100 / total)
            });

            await headerGenerator!.regenerateTarget(target, hardwarePath);
            completed++;
        }
    });

    // Restore status bar
    statusBarItem!.text = `$(chip) Beethoven (${targets.length} targets)`;
    statusBarItem!.tooltip = `${targets.length} targets regenerated`;

    vscode.window.showInformationMessage(`Beethoven: Regenerated ${targets.length} target(s)`);
}

/**
 * Show discovered targets in an output panel
 */
function showTargets(): void {
    if (targets.length === 0) {
        vscode.window.showInformationMessage('Beethoven: No targets found');
        return;
    }

    const output = vscode.window.createOutputChannel('Beethoven Targets');
    output.clear();
    output.appendLine('Beethoven Hardware Targets');
    output.appendLine('='.repeat(50));
    output.appendLine('');

    for (const target of targets) {
        output.appendLine(`Target: ${target.name}`);
        output.appendLine(`  Main class: ${target.mainClass}`);
        output.appendLine(`  Platform: ${target.platform}`);
        output.appendLine(`  Build mode: ${target.buildMode}`);
        output.appendLine(`  Output dir: ${target.outputDir}`);
        output.appendLine(`  CMakeLists: ${target.cmakeListsPath}`);
        output.appendLine('');
    }

    output.show();
}
