import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface BeethovenTarget {
    name: string;
    mainClass: string;
    platform: string;
    buildMode: string;
    cmakeListsPath: string;
    outputDir: string;
}

/**
 * Parses CMakeLists.txt files to find beethoven_hardware() calls.
 */
export class CMakeParser {
    /**
     * Find all CMakeLists.txt files in the workspace and parse them
     */
    public async findTargets(workspaceRoot: string): Promise<BeethovenTarget[]> {
        const targets: BeethovenTarget[] = [];

        // Find all CMakeLists.txt files
        const pattern = new vscode.RelativePattern(workspaceRoot, '**/CMakeLists.txt');
        const files = await vscode.workspace.findFiles(pattern, '**/build/**');

        for (const file of files) {
            const fileTargets = await this.parseCMakeFile(file.fsPath);
            targets.push(...fileTargets);
        }

        return targets;
    }

    /**
     * Parse a single CMakeLists.txt file for beethoven_hardware() calls
     */
    public async parseCMakeFile(filePath: string): Promise<BeethovenTarget[]> {
        const targets: BeethovenTarget[] = [];

        if (!fs.existsSync(filePath)) {
            return targets;
        }

        const content = fs.readFileSync(filePath, 'utf8');
        const cmakeDir = path.dirname(filePath);

        // Match beethoven_hardware() calls
        // Pattern: beethoven_hardware(TARGET_NAME
        //            MAIN_CLASS com.example.MyBuild
        //            PLATFORM discrete
        //            BUILD_MODE Simulation
        //          )
        const regex = /beethoven_hardware\s*\(\s*(\w+)([\s\S]*?)\)/g;
        let match;

        while ((match = regex.exec(content)) !== null) {
            const targetName = match[1];
            const argsBlock = match[2];

            // Extract MAIN_CLASS
            const mainClassMatch = argsBlock.match(/MAIN_CLASS\s+([^\s\)]+)/);
            const mainClass = mainClassMatch ? mainClassMatch[1] : '';

            // Extract PLATFORM (optional, default: discrete)
            const platformMatch = argsBlock.match(/PLATFORM\s+(\w+)/);
            const platform = platformMatch ? platformMatch[1] : 'discrete';

            // Extract BUILD_MODE (optional, default: Simulation)
            const buildModeMatch = argsBlock.match(/BUILD_MODE\s+(\w+)/);
            const buildMode = buildModeMatch ? buildModeMatch[1] : 'Simulation';

            if (mainClass) {
                targets.push({
                    name: targetName,
                    mainClass,
                    platform,
                    buildMode,
                    cmakeListsPath: filePath,
                    // Output goes to build/gen/<TARGET>_HW_DIR/
                    outputDir: path.join(cmakeDir, 'build', 'gen', `${targetName}_HW_DIR`)
                });

                console.log(`[Beethoven] Found target: ${targetName} (${mainClass})`);
            }
        }

        return targets;
    }
}
