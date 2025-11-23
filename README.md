# Beethoven VSCode Extension

Cross-language support for Beethoven accelerator development, bridging Scala/Chisel hardware definitions with C++ testbenches.

## Features

- **Automatic C++ Header Regeneration** - Detects Scala compilation via Bloop/Metals and regenerates `beethoven_hardware.h`
- **C++ Autocompletion** - Updates clangd configuration so C++ code sees Beethoven-generated types and functions
- **Go-to-Definition** - Jump from C++ calls like `TestSystem::matmul()` to the Scala `AccelCommand("matmul")` definition

## Requirements

- **Metals** - Scala language server (scalameta.metals)
- **clangd** - C++ language server (llvm-vs-code-extensions.vscode-clangd)
- **Bloop** - Build server (usually installed with Metals)

## Installation

### From Source

```bash
cd beethoven-vscode
npm install
npm run compile
```

Then press F5 in VSCode to launch the Extension Development Host.

### Building VSIX

```bash
npm install -g vsce
vsce package
```

Then install the generated `.vsix` file.

## Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| `beethoven.hardwarePath` | Path to Beethoven-Hardware sbt project | Auto-detected |
| `beethoven.outputPath` | Where beethoven_hardware.h is generated | Workspace root |
| `beethoven.mainClass` | Scala main class for generation | (prompted) |
| `beethoven.autoRegenerate` | Auto-regenerate headers after Scala compile | `true` |
| `beethoven.watchBloopClasses` | Watch Bloop for compilation events | `true` |

## Commands

- **Beethoven: Regenerate C++ Headers** - Manually trigger header generation
- **Beethoven: Refresh clangd Configuration** - Update clangd include paths
- **Beethoven: Show Scala-C++ Symbol Mappings** - Display all mapped symbols

## How It Works

```
┌─────────────────┐
│  Edit Scala     │
│  AccelCommand   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  Metals/Bloop   │────▶│  Compilation    │
│  compiles       │     │  succeeds       │
└─────────────────┘     └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │  Beethoven ext  │
                        │  detects change │
                        └────────┬────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Run sbt/bloop  │     │  Update .clangd │     │  Parse header   │
│  to regenerate  │     │  include paths  │     │  for symbols    │
│  headers        │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │  C++ code gets  │
                        │  completions &  │
                        │  go-to-def      │
                        └─────────────────┘
```

## Symbol Mapping

The extension parses `beethoven_hardware.h` to find generated C++ namespaces and functions:

```cpp
namespace TestSystem {
    beethoven::response_handle<bool> matmul(uint16_t core_id, ...);
}
```

Then searches Scala sources for corresponding `AccelCommand` definitions:

```scala
class SystolicArrayCmd extends AccelCommand("matmul") {
    val wgt_addr = UInt(64.W)
    // ...
}
```

This enables jumping from C++ usage to Scala definition.

## Troubleshooting

### Headers not regenerating
- Check `beethoven.mainClass` is set correctly
- Ensure Bloop/Metals is running (check Metals status bar)
- Try manual regeneration: "Beethoven: Regenerate C++ Headers"

### C++ completions not working
- Check `.clangd` file was created with correct include paths
- Run "Beethoven: Refresh clangd Configuration"
- Restart clangd: "clangd: Restart language server"

### Go-to-definition not finding Scala sources
- Run "Beethoven: Show Scala-C++ Symbol Mappings" to see what's detected
- Ensure Scala files are in the workspace
- Check that `AccelCommand("name")` pattern is used

## Development

```bash
# Watch mode
npm run watch

# Run tests (when added)
npm test

# Lint
npm run lint
```

## License

Apache-2.0 (same as Beethoven)
