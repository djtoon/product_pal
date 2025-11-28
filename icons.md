# Collie - Icons Reference

This document lists all icons used in the application and their usage.

---

## SVG Icon Files

Located in `src/renderer/assets/icons/`

| Icon File | Description | Used In | Purpose |
|-----------|-------------|---------|---------|
| `logo.svg` | App logo | `TitleBar.tsx` | Title bar app icon |
| `weclome.svg` | Welcome screen logo | `WelcomeScreen.tsx` | Main welcome screen branding |
| `newfile.svg` | Document with lines | `IconSidebar.tsx`, `WelcomeScreen.tsx` | New Document button, feature icon |
| `chat.svg` | Chat bubble with dots | `IconSidebar.tsx` | AI Assistant button in sidebar |
| `ai_avatar.svg` | AI robot avatar | `AIChat.tsx` | AI Assistant header & message avatar |
| `settings.svg` | Gear/cog icon | `IconSidebar.tsx`, `WelcomeScreen.tsx` | Settings button, feature icon |
| `folder.svg` | Folder icon | `WelcomeScreen.tsx` | Open folder button |
| `workspace.svg` | Workspace/directory icon | `AIChat.tsx` | Workspace context indicator |
| `current_file.svg` | File document icon | `AIChat.tsx` | Current file context indicator |

---

## Inline SVG Icons (TitleBar Window Controls)

Located inline in `src/renderer/components/TitleBar.tsx`

### Minimize Button
```svg
<svg width="12" height="12" viewBox="0 0 12 12">
  <rect x="1" y="5.5" width="10" height="1" fill="currentColor"/>
</svg>
```
- **Description**: Horizontal line
- **Used in**: Window controls (title bar right side)
- **Purpose**: Minimize window button

### Maximize Button
```svg
<svg width="12" height="12" viewBox="0 0 12 12">
  <rect x="1.5" y="1.5" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1"/>
</svg>
```
- **Description**: Square outline
- **Used in**: Window controls (title bar right side)
- **Purpose**: Maximize window button

### Restore Button (when maximized)
```svg
<svg width="12" height="12" viewBox="0 0 12 12">
  <rect x="3" y="1" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1"/>
  <rect x="1" y="3" width="8" height="8" fill="#202020" stroke="currentColor" strokeWidth="1"/>
</svg>
```
- **Description**: Two overlapping squares
- **Used in**: Window controls (title bar right side, when window is maximized)
- **Purpose**: Restore window button

### Close Button
```svg
<svg width="12" height="12" viewBox="0 0 12 12">
  <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1"/>
</svg>
```
- **Description**: X shape (two crossed lines)
- **Used in**: Window controls (title bar right side)
- **Purpose**: Close window button

---

## Emoji Icons (Remaining)

| Emoji | Location | File | Purpose |
|-------|----------|------|---------|
| 👤 | AI Chat | `AIChat.tsx` | User message avatar |
| 🗑️ | AI Chat | `AIChat.tsx` | Clear chat button |

---

## Icon Color Scheme

All SVG icons follow the dark theme color scheme:
- **Primary color**: White (`#FFFFFF`)
- **Background**: Dark (`#202020` for title bar)
- **Hover states**: Handled via CSS opacity/background changes

---

## Icon Sizes by Location

| Location | Size | CSS Class |
|----------|------|-----------|
| Title Bar Logo | 16x16 | `.title-bar-icon img` |
| Welcome Screen Logo | 80x80 | `.welcome-icon` |
| Welcome Features | 20x20 | `.feature-icon` |
| Welcome Button | 24x24 | `.btn-icon` |
| Icon Sidebar | 24x24 | `.icon img` |
| AI Chat Header | 24x24 | `.ai-icon` |
| AI Context Bar | 14x14 | `.ai-context-icon` |
| AI Message Avatar | 28x28 | `.ai-message-avatar img` |

---

## Adding New Icons

1. **SVG Files**: Place in `src/renderer/assets/icons/`
   - Use white color for consistency with dark theme
   - Import in component: `import iconName from '../assets/icons/iconname.svg'`
   - Use as: `<img src={iconName} alt="description" className="icon-class" />`

2. **Inline SVGs**: For simple icons in title bar or buttons
   - Use `currentColor` for fills/strokes to inherit text color
   - Keep viewBox consistent with visual size

3. **Sizing**: Add appropriate CSS class for sizing based on location
