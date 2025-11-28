# Collie

AI-powered document editor for Product Managers. Create, edit, and manage product documentation with a powerful, modern interface and built-in AI assistant.

![Collie](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

### 🎯 Built for Product Managers
- **Document Templates**: Pre-built templates for PRDs, Technical Specs, and User Stories
- **Rich Editor**: Monaco Editor (same as VSCode) with syntax highlighting
- **Markdown Support**: Real-time preview for markdown documents
- **Command Palette**: Quick access to all features (Ctrl+Shift+P)

### 📁 File Management
- Open and navigate workspace folders
- File tree with expand/collapse
- Create, rename, and delete files/folders
- Support for .md, .txt, .prd and more

### ✨ Developer Experience
- Auto-save on Ctrl+S
- Multiple file tabs
- Status bar with file information
- Keyboard shortcuts
- Modern, clean UI inspired by VSCode

## Quick Start

### Installation

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev  # In terminal 1
npm start    # In terminal 2
```

### Build for Production

```bash
# Build the app
npm run build

# Package for Windows
npm run package
```

See [BUILD.md](BUILD.md) for detailed build instructions.

## Usage

1. **Open a Folder**: File > Open Folder (Ctrl+O)
2. **Create Documents**: Use templates via Templates menu or Command Palette
3. **Edit Files**: Click files in the sidebar to open them
4. **Preview Markdown**: Click the preview button for .md files
5. **Save Changes**: Ctrl+S

See [GETTING_STARTED.md](GETTING_STARTED.md) for a complete guide.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+O` | Open Folder |
| `Ctrl+N` | New File |
| `Ctrl+S` | Save File |
| `Ctrl+Shift+P` | Command Palette |
| `Ctrl+F` | Find in File |

## Tech Stack

- **Electron 32+**: Desktop application framework
- **React 18**: UI library
- **TypeScript**: Type-safe development
- **Monaco Editor**: Rich code editor
- **Webpack**: Module bundler
- **Marked**: Markdown parser

## Project Structure

```
product_pal/
├── src/
│   ├── main/              # Electron main process
│   ├── renderer/          # React UI components
│   │   ├── components/    # UI components
│   │   ├── templates/     # Document templates
│   │   └── styles/        # CSS styles
│   └── shared/            # Shared TypeScript types
├── dist/                  # Build output
└── release/              # Packaged apps
```

## Contributing

Contributions are welcome! This is a prototype application built to demonstrate VSCode-like functionality for product managers.

## License

MIT License - feel free to use this project as a starting point for your own applications.

## Future Enhancements

- Git integration for version control
- PDF export for documents
- Team collaboration features
- Plugin/extension system
- Custom themes
- AI-powered writing assistance
- Cloud sync
- Comments and annotations

## Support

For issues or questions, please check the [BUILD.md](BUILD.md) troubleshooting section.

---

Built with ❤️ for Product Managers

