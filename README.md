# Collie

<p align="center">
  <img src="https://raw.githubusercontent.com/djtoon/product_pal/refs/heads/main/assets/icons/icon.png" alt="Collie" width="128" height="128">
</p>

**AI-powered document editor for Product Managers.** Create, edit, and manage product documentation with a powerful, modern interface and built-in AI assistant.

[![Version](https://img.shields.io/badge/version-0.1.0-blue)](https://github.com/danshamir/collie/releases)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey)](https://github.com/danshamir/collie/releases)

---

## Features

### AI Assistant

- **Multi-Provider Support**: Choose between:
  - **AWS Bedrock** - Claude Opus 4.5
  - **OpenAI** - GPT-5.1, GPT-4o
  - **Ollama** - Run local LLMs (Qwen 3, Llama 3, Mistral, and more)
- **Smart Document Generation**: Create PRDs, Technical Specs, and User Stories with AI assistance
- **Context-Aware**: AI understands your workspace and current document
- **Tool Integration**: AI can read/write files, create directories, and manage your project
- **Real-time Streaming**: See AI responses as they're generated with thinking visualization
- **Task Tracking**: Built-in todo list for AI-assisted workflows
- **One-Click Model Install**: Download and manage Ollama models directly from settings

### AI Stakeholder Simulator

Simulate PRD reviews with AI-powered stakeholder personas before real meetings:

- **Role-Based Personas**: Engineer, Designer, Legal, CEO, Marketing, and custom roles
- **Structured Feedback**: Get blockers, concerns, questions, and suggestions from each stakeholder
- **Risk Assessment**: Overall risk level (low/medium/high) and readiness for review
- **Quick Access**: Click "🎭 Simulate" on any PRD file to run a simulation
- **Uses Your Team**: Leverages your defined stakeholders with their specific roles

### Document Editor

- **Monaco Editor**: Same powerful editor as VSCode with syntax highlighting
- **Markdown Preview**: Real-time side-by-side preview for markdown files
- **PDF Export**: Export any markdown document to PDF with styled formatting
- **Document Templates**: Pre-built templates for:
  - Product Requirements Documents (PRD)
  - Technical Specifications
  - User Stories
  - Create your own templates
- **Multi-tab Editing**: Work on multiple documents simultaneously

### Kanban Board

Visual kanban boards stored as markdown files:

- **Drag & Drop**: Move cards between columns easily
- **Priority Levels**: High, medium, low priority indicators
- **Card Details**: Title, description, and completion status
- **Markdown Storage**: Boards are saved as readable markdown files
- **Create with**: Use `# [KANBAN] Board Title` header in any `.md` file

### Timeline / Roadmap Editor

Visual timeline editor for project planning:

- **Multiple Phases**: Organize events into phases
- **Event Status**: Completed, In Progress, Upcoming, Delayed
- **Date Tracking**: Set dates for each milestone
- **Markdown Storage**: Timelines are saved as readable markdown
- **Create with**: Use `# [TIMELINE] Timeline Title` header in any `.md` file

### Media Viewer

View media files directly in the editor:

- **Images**: PNG, JPG, GIF, WebP, SVG, BMP, ICO (with zoom controls)
- **Video**: MP4, WebM, OGG, MOV, AVI, MKV (with playback controls)
- **Audio**: MP3, WAV, OGG, FLAC, AAC, M4A, WMA
- **PDF**: Embedded PDF viewing

### Stakeholder Management

Define and manage your team for simulations:

- **Add Team Members**: Name and role for each stakeholder
- **Role-Based AI**: AI assumes appropriate perspective based on role
- **Persistent Storage**: Stakeholders saved across sessions
- **Edit & Delete**: Full management capabilities

### MCP (Model Context Protocol) Support

Extend AI capabilities with external tools:

- **MCP Server Integration**: Connect to stdio or HTTP MCP servers
- **Tool Discovery**: Automatically discovers available tools
- **JSON Config Editor**: Edit `mcp.json` directly in the app
- **Real-time Status**: See connection status with color indicators
- **Server Logs**: View MCP server output in the terminal panel

### Integrated Terminal

Full terminal access within the app:

- **Shell Tab**: Interactive shell terminal (PowerShell/Bash)
- **MCP Logs Tab**: View all MCP server output
- **Resizable Panel**: Drag to resize terminal area
- **Theme Matched**: Terminal colors match the app theme

### File Management

- **Workspace Navigation**: Open and browse project folders
- **File Tree**: Expandable/collapsible directory structure with icons
- **Full CRUD Operations**: Create, rename, delete, and copy files/folders
- **File Watching**: Auto-refresh when external changes are detected
- **Drag & Drop**: Reorganize files easily
- **New File Dialog**: Create files with custom names and extensions

### Productivity

- **Command Palette**: Quick access to all features (`Ctrl+Shift+P`)
- **Keyboard Shortcuts**: Familiar VSCode-style shortcuts
- **Auto-save**: Never lose your work
- **Welcome Screen**: Quick actions when no file is open
- **Frameless Design**: Modern, clean UI with custom title bar
- **Status Bar**: File info and workspace status at a glance

---

## Quick Start

### Download

Download the latest release from the [Releases](https://github.com/danshamir/collie/releases) page:

**Windows**
- `Collie-0.1.0-Setup.exe` - Standard installation
- `Collie-0.1.0-Portable.exe` - No installation required

**macOS**
- `Collie-0.1.0-arm64.dmg` - Apple Silicon (M1/M2/M3)
- `Collie-0.1.0-x64.dmg` - Intel Macs

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

---

## Configuration

### AI Setup

1. Open Settings (gear icon or `Ctrl+,`)
2. Enable AI Assistant
3. Choose your provider:

#### AWS Bedrock (Claude)
- Enter your AWS Access Key ID and Secret Access Key
- Select your preferred AWS region
- IAM user needs `bedrock:InvokeModel` permission

#### OpenAI
- Enter your OpenAI API key
- Optionally configure a custom base URL for compatible APIs

#### Ollama (Local LLM)
- Install Ollama from [ollama.com](https://ollama.com) or use the "Install Ollama" button
- Select a model from the dropdown (recommended: Qwen 3 8B or Llama 3.1 8B)
- Click "Install Model" to download - progress shown in real-time
- Delete unused models with the "Uninstall" button

4. Click "Test Connection" to verify
5. Save settings

> **Note**: Credentials are stored locally on your machine and never transmitted anywhere except to the AI provider.

### MCP Configuration

1. Create an `mcp.json` file in your workspace root:

```json
{
  "mcpServers": {
    "my-server": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/folder"]
    }
  }
}
```

2. Open the MCP panel (plug icon in sidebar)
3. Servers auto-connect on startup
4. View available tools and connection status

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+O` | Open Folder |
| `Ctrl+N` | New File |
| `Ctrl+S` | Save File |
| `Ctrl+Shift+P` | Command Palette |
| `Ctrl+F` | Find in File |
| `Ctrl+,` | Open Settings |
| `Ctrl+Shift+A` | Toggle AI Chat |

---

## Tech Stack

- **Electron 32** - Desktop application framework
- **React 18** - UI library
- **TypeScript** - Type-safe development
- **Monaco Editor** - Rich code editor (VSCode's editor)
- **Strands Agents SDK** - AI agent framework
- **AWS SDK** - Bedrock integration
- **OpenAI SDK** - GPT integration
- **Ollama** - Local LLM support
- **xterm.js** - Terminal emulator
- **Webpack** - Module bundler

---

## Project Structure

```
collie/
├── src/
│   ├── main/                 # Electron main process
│   │   ├── main.ts           # App entry point
│   │   ├── ipc-handlers.ts   # IPC communication
│   │   ├── strands-agent.ts  # AI agent implementation
│   │   └── ollama-agent.ts   # Ollama-specific agent
│   ├── renderer/             # React UI
│   │   ├── components/       # UI components
│   │   │   ├── AIChat.tsx            # AI chat panel
│   │   │   ├── EditorPane.tsx        # Main editor
│   │   │   ├── KanbanEditor.tsx      # Kanban board
│   │   │   ├── TimelineEditor.tsx    # Timeline editor
│   │   │   ├── MediaViewer.tsx       # Media file viewer
│   │   │   ├── MCPPanel.tsx          # MCP management
│   │   │   ├── TerminalPanel.tsx     # Integrated terminal
│   │   │   ├── StakeholderSimulator.tsx  # AI simulation
│   │   │   └── ...
│   │   ├── context/          # React context
│   │   ├── styles/           # CSS styles
│   │   └── templates/        # Document templates
│   └── shared/               # Shared types & settings
├── templates/                # User-accessible templates
├── dist/                     # Build output
└── release/                  # Packaged executables
```

---

## Roadmap

- [x] Multi-provider AI support (Bedrock, OpenAI, Ollama)
- [x] MCP server support
- [x] PDF export
- [x] Stakeholder simulator
- [x] Media file viewing
- [x] Kanban boards
- [x] Timeline editor
- [x] Integrated terminal
- [ ] Linux builds
- [ ] Git integration for version control
- [ ] Custom template creation UI
- [ ] Plugin/extension system
- [ ] Cloud sync
- [ ] Collaborative editing

---

## Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest features
- Submit pull requests

---

## License

MIT License - see [LICENSE](LICENSE) for details.

Feel free to use this project as a starting point for your own applications.

---

## Author

**Dan Shamir**

---

<p align="center">
  Built for Product Managers
</p>
