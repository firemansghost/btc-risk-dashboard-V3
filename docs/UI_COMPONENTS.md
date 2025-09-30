# UI Components Documentation

Comprehensive documentation for the Bitcoin Risk Dashboard's visual components and interactive elements.

## Radial Gauge Component

### Overview
The `RadialGauge` component is a professional SVG-based gauge that displays the Bitcoin G-Score with advanced visual effects, animations, and accessibility features.

### Features

#### Visual Design
- **Professional SVG Implementation**: Pure SVG for crisp rendering at any scale
- **Gradient Overlays**: Linear gradients for each risk band with depth and richness
- **Glow Effects**: Subtle glow filters on hover for enhanced interactivity
- **Thick Arc Segments**: 12px stroke width for prominent risk band visibility
- **Color-Coded Bands**: Six distinct colors for clear visual distinction

#### Animations
- **Smooth Needle Rotation**: 60fps needle animation with easeOutCubic easing
- **Staggered Band Appearance**: Sequential band reveal with 100ms delays
- **Hover Micro-Animations**: Enhanced feedback with scale and glow effects
- **Loading States**: Professional loading spinner with circular progress
- **Particle Effects**: Subtle particle system on component mount

#### Accessibility Features
- **Screen Reader Support**: Dynamic announcements for score changes
- **Keyboard Navigation**: Arrow key navigation between score ranges
- **High Contrast Mode**: Automatic detection and enhanced visibility
- **Reduced Motion Support**: Respects `prefers-reduced-motion` user preference
- **Focus Management**: Clear focus indicators and proper tab order

#### Performance Optimizations
- **Memory Cleanup**: Proper event listener and animation cleanup
- **60fps Animations**: Optimized requestAnimationFrame usage
- **Conditional Rendering**: Respects user motion preferences
- **Efficient State Management**: Optimized re-renders and dependencies

### Technical Implementation

#### Component Structure
```typescript
interface RadialGaugeProps {
  score: number;
  bandLabel: string;
  className?: string;
}
```

#### Key Features
- **Responsive Design**: Scales appropriately for desktop and mobile
- **Touch Support**: Mobile-friendly touch interactions
- **Accessibility Compliance**: WCAG 2.1 AA compliance
- **Performance Optimized**: Memory efficient with proper cleanup

#### Animation System
- **Needle Animation**: Smooth rotation using requestAnimationFrame
- **Band Animation**: Staggered appearance with CSS keyframes
- **Hover Effects**: Micro-animations with CSS transitions
- **Loading States**: Custom loading spinner with stroke-dasharray

#### Accessibility Implementation
- **ARIA Labels**: Comprehensive screen reader support
- **Keyboard Navigation**: Full keyboard accessibility
- **High Contrast**: Automatic detection and adaptation
- **Reduced Motion**: Respects user motion preferences

### Usage Examples

#### Basic Usage
```tsx
<RadialGauge 
  score={56} 
  bandLabel="Hold & Wait" 
  className="w-64 h-32" 
/>
```

#### With Custom Styling
```tsx
<RadialGauge 
  score={score} 
  bandLabel={bandLabel} 
  className="w-80 h-40 drop-shadow-lg" 
/>
```

### Configuration

#### Risk Band Colors
The gauge uses six distinct colors for optimal visual distinction:
- **Purple**: Aggressive Buying (0-14)
- **Blue**: Regular DCA Buying (15-34)
- **Green**: Moderate Buying (35-49)
- **Yellow**: Hold & Wait (50-64)
- **Orange**: Reduce Risk (65-79)
- **Red**: High Risk (80-100)

#### Animation Timing
- **Needle Rotation**: 800ms duration with easeOutCubic easing
- **Band Appearance**: 100ms staggered delays
- **Hover Effects**: 300ms transitions
- **Loading Spinner**: 1.5s linear infinite

#### Accessibility Settings
- **Screen Reader**: Automatic announcements on score changes
- **Keyboard**: Arrow keys for score navigation (5-point increments)
- **High Contrast**: Enhanced visibility with black segments
- **Reduced Motion**: Disabled animations for motion-sensitive users

### Performance Considerations

#### Memory Management
- Automatic cleanup of event listeners on unmount
- Proper animation cleanup to prevent memory leaks
- Efficient state management with minimal re-renders

#### Animation Performance
- 60fps smooth animations using requestAnimationFrame
- Conditional rendering based on user preferences
- Optimized CSS transitions and transforms

#### Accessibility Performance
- Respects user motion preferences
- Efficient screen reader announcements
- Optimized keyboard navigation

### Browser Support
- **Modern Browsers**: Full support for all features
- **SVG Support**: Required for gauge rendering
- **CSS Grid/Flexbox**: Required for layout
- **ES6+ Features**: Required for component functionality

### Future Enhancements
- **Data Integration**: Historical score indicators
- **Trend Arrows**: Direction indicators for score changes
- **Confidence Indicators**: Visual representation of data reliability
- **Advanced Interactions**: Touch gestures and enhanced keyboard navigation
