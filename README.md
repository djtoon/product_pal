# Collie 🐕

**AI-powered document editor for Product Managers.** Create, edit, and manage product documentation with a powerful, modern interface and built-in AI assistant.

[![Version](https://img.shields.io/badge/version-0.1.0-blue)](https://github.com/danshamir/collie/releases)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows-lightgrey)](https://github.com/danshamir/collie/releases)

## ✨ Features

### 🤖 AI Assistant
- **Multi-Provider Support**: Choose between AWS Bedrock (Claude) or OpenAI (GPT)
- **Smart Document Generation**: Create PRDs, Technical Specs, and User Stories with AI assistance
- **Context-Aware**: AI understands your workspace and current document
- **Tool Integration**: AI can read/write files, create directories, and manage tasks
- **Real-time Streaming**: See AI responses as they're generated
- **Task Tracking**: Built-in todo list for AI-assisted workflows

### 📝 Document Editor
- **Monaco Editor**: Same powerful editor as VSCode with syntax highlighting
- **Markdown Preview**: Real-time side-by-side preview for markdown files
- **Document Templates**: Pre-built templates for PRDs, Technical Specs, User Stories, Kanban boards, and Timelines
- **Multi-tab Editing**: Work on multiple documents simultaneously

### 📁 File Management
- **Workspace Navigation**: Open and browse project folders
- **File Tree**: Expandable/collapsible directory structure
- **Full CRUD**: Create, rename, delete, and copy files/folders
- **File Watching**: Auto-refresh when external changes are detected
- **Drag & Drop**: Reorganize files easily

### ⚡ Productivity
- **Command Palette**: Quick access to all features (`Ctrl+Shift+P`)
- **Keyboard Shortcuts**: Familiar VSCode-style shortcuts
- **Auto-save**: Never lose your work
- **Custom Themes**: Choose your preferred color scheme
- **Frameless Design**: Modern, clean UI with custom title bar

## 🚀 Quick Start

### Download
Download the latest release from the [Releases](https://github.com/danshamir/collie/releases) page:
- **Setup Installer**: `Collie-0.1.0-Setup.exe` - Standard installation
- **Portable**: `Collie-0.1.0-Portable.exe` - No installation required

### Build from Source

```bash
# Clone the repository
git clone https://github.com/danshamir/collie.git
cd collie

# Install dependencies
npm install

# Run in development mode
npm run dev    # Terminal 1: Watch & compile
npm start      # Terminal 2: Run app

# Build for production
npm run build
npm run package
```

See [BUILD.md](BUILD.md) for detailed build instructions.

## ⚙️ Configuration

### AI Setup
1. Open Settings (gear icon or `Ctrl+,`)
2. Enable AI Assistant
3. Choose your provider:

**AWS Bedrock (Claude)**
- Enter your AWS Access Key ID and Secret Access Key
- Select your preferred AWS region
- IAM user needs `bedrock:InvokeModel` permission

**OpenAI**
- Enter your OpenAI API key
- Optionally configure a custom base URL for compatible APIs

4. Click "Test Connection" to verify
5. Save settings

> 💡 **Note**: Credentials are stored locally on your machine and never transmitted anywhere except to the AI provider.

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+O` | Open Folder |
| `Ctrl+N` | New File |
| `Ctrl+S` | Save File |
| `Ctrl+Shift+P` | Command Palette |
| `Ctrl+F` | Find in File |
| `Ctrl+,` | Open Settings |

## 🛠️ Tech Stack

- **Electron 32** - Desktop application framework
- **React 18** - UI library
- **TypeScript** - Type-safe development
- **Monaco Editor** - Rich code editor (VSCode's editor)
- **Strands Agents SDK** - AI agent framework
- **AWS SDK** - Bedrock integration
- **OpenAI SDK** - GPT integration
- **Webpack** - Module bundler

## 📁 Project Structure

```
collie/
├── src/
│   ├── main/              # Electron main process
│   │   ├── main.ts        # App entry point
│   │   ├── ipc-handlers.ts # IPC communication
│   │   └── strands-agent.ts # AI agent implementation
│   ├── renderer/          # React UI
│   │   ├── components/    # UI components
│   │   ├── context/       # React context
│   │   ├── styles/        # CSS styles
│   │   └── templates/     # Document templates
│   └── shared/            # Shared types & settings
├── templates/             # User-accessible templates
├── dist/                  # Build output
└── release/               # Packaged executables
```

## 🗺️ Roadmap

- [ ] macOS and Linux builds
- [ ] Git integration for version control
- [ ] PDF export
- [ ] MCP (Model Context Protocol) server support
- [ ] Custom template creation UI
- [ ] Plugin/extension system
- [ ] Cloud sync
- [ ] Collaborative editing

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest features
- Submit pull requests

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

Feel free to use this project as a starting point for your own applications.

## 👤 Author

**Dan Shamir**

---

<p align="center">
  Built with ❤️ for Product Managers
</p>
