# 3D Assembly Viewer

An interactive 3D assembly viewer with mobile support, video playback, and advanced part analysis features.

## 🚀 Features

### 📱 **Mobile & Tablet Support**
- **Responsive design** that works on all screen sizes
- **Touch controls** with pinch-to-zoom, rotation, and pan gestures
- **Mobile-optimized UI** with larger touch targets
- **Haptic feedback** on supported devices
- **Orientation change handling**

### 🎬 **Video Integration**
- **Automatic video detection** from Resources folder
- **Part-specific video playback** with exact name matching
- **Full-screen video overlay** with controls
- **Smart button states** (disabled for parts without videos)

### 🔧 **3D Visualization**
- **Interactive 3D model** with Three.js
- **Part selection and highlighting**
- **Multiple camera views** (front, top, back, isometric)
- **Ghost mode** for focusing on selected parts
- **Sectioning tools** for part analysis

### ⚙️ **Advanced Controls**
- **Part isolation** and restoration
- **Material customization** (color, roughness)
- **Lighting controls** and shadow quality
- **Camera modes** (perspective/orthographic)
- **Up-axis orientation** settings

## 🛠️ Installation & Setup

### Prerequisites
- Modern web browser with WebGL support
- Python 3.x (for local development server)

### Local Development
1. **Clone the repository:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/3d-assembly-viewer.git
   cd 3d-assembly-viewer
   ```

2. **Start the development server:**
   ```bash
   python3 test-server.py
   ```

3. **Open your browser:**
   Navigate to `http://localhost:8081`

### Production Deployment
The app can be deployed to any static hosting service:
- **GitHub Pages** (recommended)
- **Netlify**
- **Vercel**
- **Any web server**

## 📁 Project Structure

```
├── assembly-viewer.html      # Main HTML file
├── assembly-viewer.css       # Responsive styles
├── assembly-viewer.js        # Main application logic
├── part-manager.js          # Part management and video controls
├── part-analyzer.js         # OBJ file analysis
├── PipeAssembly.obj         # 3D model file
├── Resources/               # Video files directory
│   └── bend pipe.mp4        # Part-specific videos
├── test-server.py           # Development server
└── README.md               # This file
```

## 🎮 Usage

### Desktop Controls
- **Mouse drag** - Rotate camera
- **Mouse wheel** - Zoom in/out
- **Right-click drag** - Pan camera
- **Click parts** - Select and view details

### Mobile Controls
- **Single finger drag** - Rotate camera
- **Pinch gesture** - Zoom in/out
- **Two-finger drag** - Pan camera
- **Double tap** - Reset camera view
- **Tap parts** - Select and view details

### Video Playback
- **Play button** appears for parts with matching videos
- **Full-screen playback** with native controls
- **Automatic video detection** from Resources folder

## 🔧 Configuration

### Adding Videos
1. Place MP4 files in the `Resources/` folder
2. Name files exactly matching part names (e.g., `bend pipe.mp4`)
3. The app will automatically detect and enable playback

### Customizing Materials
- Use the settings panel (gear icon) to adjust:
  - Material color and roughness
  - Lighting intensity
  - Shadow quality
  - Camera mode

## 🌐 Browser Support

- **Chrome** 60+
- **Firefox** 55+
- **Safari** 12+
- **Edge** 79+
- **Mobile browsers** (iOS Safari, Chrome Mobile)

## 📱 Mobile Features

- **Touch-optimized interface** with 44px minimum touch targets
- **Responsive layouts** for phones and tablets
- **Gesture support** for natural 3D navigation
- **Performance optimizations** for mobile devices

## 🚀 Deployment

### GitHub Pages
1. Enable Pages in repository settings
2. Select "Deploy from a branch"
3. Choose "main" branch
4. Your app will be available at `https://YOUR_USERNAME.github.io/3d-assembly-viewer/`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🆘 Support

If you encounter any issues:
1. Check the browser console for errors
2. Ensure all files are properly served
3. Verify video files are in the correct format (MP4)
4. Check that the 3D model file is accessible

---

**Built with ❤️ using Three.js and modern web technologies**
