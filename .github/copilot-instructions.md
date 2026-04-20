# Copilot Instructions

This repository contains educational web tools for teachers and students, hosted on GitHub Pages at custom.scienceclass.rocks.

## Tech Stack

- **Frontend**: Pure HTML5 with embedded JavaScript (no build system)
- **Styling**: TailwindCSS via CDN (`https://cdn.tailwindcss.com`)
- **Backend**: Firebase (Firestore for database, Firebase Auth for authentication)
- **Authentication**: Google Sign-In for teachers, passcode-based sign-in for students
- **Hosting**: GitHub Pages

## Project Structure

- `dashboard.html` - Teacher dashboard for viewing and managing student submissions
- `editor.html` - Assignment editor for teachers to create and edit assignments
- `classroompicker.html` - IterātED classroom tool for student interactions
- `assignments.html` - Assignment listing and management
- `roster.html` - Student roster management
- `export.html` - Data export functionality
- `checker_tester.html` - Testing tool for assignment checkers
- `notes.html` - Notes functionality

## Coding Conventions

### HTML/JavaScript
- Use semantic HTML5 elements
- Keep JavaScript embedded in HTML files (single-file components)
- Use `const` and `let` instead of `var`
- Use async/await for asynchronous operations with Firebase
- Use template literals for string interpolation

### Styling
- Use TailwindCSS utility classes for all styling
- Dark theme with `bg-gray-900` as the primary background
- Yellow (`text-yellow-400`) for headings and accents
- Consistent padding and margin using Tailwind's spacing scale

### Firebase Patterns
- Use Firebase compat SDK (version 9.15.0)
- Initialize Firebase at the start of each page
- Use Firestore for data persistence
- Handle authentication state changes properly

### UI/UX Patterns
- Show loading states while fetching data
- Display error messages in red (`text-red-500`)
- Use modals for detailed views and editing
- Implement toast notifications for user feedback
- Support responsive design for various screen sizes

## Best Practices

1. **Security**: Never expose Firebase API keys or sensitive credentials in client-side code beyond what's necessary for Firebase initialization
2. **Accessibility**: Include proper ARIA labels and semantic HTML
3. **Error Handling**: Always wrap Firebase operations in try-catch blocks
4. **Performance**: Minimize DOM manipulations and batch Firestore operations when possible
5. **User Experience**: Provide clear feedback for all user actions
