# Groundwork — Property Layout Planning

## Overview
Groundwork is a collaborative PWA where users draw shapes, lines, and text over Google Maps satellite imagery to create property layout plans. Built on Next.js 16 + MongoDB + Google OAuth.

## System Architecture

### Tech Stack
- **Next.js 16** (App Router) — framework, API routes, middleware auth
- **MongoDB** via Mongoose — data persistence
- **Google OAuth** via NextAuth.js — authentication (any Google user can sign in)
- **Google Maps JavaScript API** — satellite map base layer
- **Tailwind CSS** + shadcn/ui — styling and UI components
- **html2canvas** + **jsPDF** — export to PNG/PDF
- **PWA** — installable web app via manifest.json

### Data Models
- `Project` — name, snapshot (map position), layers[], visibility, createdBy
- `ProjectMember` — projectId, userId, email, role (owner/editor/viewer)
- `Feature` — projectId, layerId, groupId, type, GeoJSON geometry, properties
- `Group` — projectId, groupId (UUID), sharedProperties

### API Routes
- `/api/projects` — GET (list), POST (create)
- `/api/projects/[id]` — GET, PUT, DELETE
- `/api/projects/[id]/duplicate` — POST
- `/api/projects/[id]/features` — GET, POST
- `/api/projects/[id]/features/[featureId]` — PUT, DELETE
- `/api/projects/[id]/features/bulk` — POST
- `/api/projects/[id]/members` — GET, POST
- `/api/projects/[id]/members/[memberId]` — PUT, DELETE
- `/api/projects/[id]/groups` — POST
- `/api/projects/[id]/groups/[groupId]` — PUT, DELETE

### Frontend Pages
- `/` — Landing page
- `/login` — Google OAuth login
- `/projects` — Project directory (protected)
- `/projects/[id]` — Map view + drawing tools (protected)

### Key Components
- `MapView.tsx` — Google Maps with satellite tiles, feature overlays, drawing handlers
- `Toolbar.tsx` — Drawing tool selection, undo/redo
- `LayersPanel.tsx` — Layer management (add, rename, delete, reorder, visibility)
- `PropertiesPanel.tsx` — Feature properties (colors, stroke, labels, arrows)
- `ShareDialog.tsx` — Collaboration (invite by email, role management)
- `ExportMenu.tsx` — PNG/PDF export
- `TopBar.tsx` — Project header with navigation and actions

### Drawing Tools
Polygon, Rectangle, Circle, Polyline, Line, Text — all using Google Maps JS API overlays. Click to add points, double-click to finish polygons/polylines. Features saved as GeoJSON to MongoDB.

### Permissions
- Owner: full access, can delete project, manage all members
- Editor: can draw, edit features, invite members
- Viewer: read-only access

### Environment Variables
- `MONGODB_URI` — MongoDB connection string
- `NEXTAUTH_SECRET` — NextAuth session secret
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Google OAuth credentials
- `NEXT_PUBLIC_GOOGLE_MAPS_KEY` — Google Maps JavaScript API key
