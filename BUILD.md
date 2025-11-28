# Build Instructions

## Prerequisites
- Node.js 18+ installed
- npm or yarn package manager

## Installation

1. Install dependencies:
```bash
npm install
```

## Development

To run the app in development mode:

1. In one terminal, start the webpack watcher:
```bash
npm run dev
```

2. In another terminal, start the Electron app:
```bash
npm start
```

The app will launch with DevTools open for debugging.

## Building for Production

To build the application:

```bash
npm run build
```

To package the app for distribution (Windows):

```bash
npm run package
```

The packaged app will be in the `release` folder.

## Project Structure

```
product_pal/
├── src/
│   ├── main/              # Electron main process
│   │   ├── main.ts        # App entry point
│   │   ├── menu.ts        # Application menu
│   │   └── ipc-handlers.ts # IPC communication
│   ├── renderer/          # React UI
│   │   ├── components/    # React components
│   │   ├── context/       # React context
│   │   ├── templates/     # Document templates
│   │   ├── styles/        # CSS styles
│   │   └── utils/         # Utility functions
│   └── shared/           # Shared types
├── dist/                 # Compiled output
└── release/             # Packaged applications
```

## Features

### Implemented
✅ Electron + React + TypeScript setup
✅ Monaco Editor integration
✅ File system operations (open, save, create, delete, rename)
✅ File tree navigation
✅ Document templates (PRD, Tech Spec, User Story)
✅ Command palette (Ctrl+Shift+P)
✅ Markdown preview
✅ Syntax highlighting for multiple languages
✅ Tab management
✅ Status bar with file info
✅ Keyboard shortcuts

### Keyboard Shortcuts
- `Ctrl+O` - Open folder
- `Ctrl+N` - New file
- `Ctrl+S` - Save file
- `Ctrl+Shift+P` - Command palette
- `Ctrl+F` - Find in file (Monaco built-in)

## Troubleshooting

### App won't start
- Make sure you ran `npm install`
- Check that both webpack build and electron start are running
- Check the console for any error messages

### Files won't open
- Ensure you have read permissions for the folder
- Check the DevTools console for errors

### Build fails
- Clear the `dist` folder and rebuild
- Update dependencies: `npm update`

## Next Steps

Future enhancements could include:
- Git integration
- Export to PDF
- Collaboration features
- Plugin system
- Themes customization
- AI-powered suggestions

