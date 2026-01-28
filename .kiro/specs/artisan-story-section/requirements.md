# Artisan Story Section - Requirements Document

## Overview
A dedicated section on the homepage to introduce the artisan (Anh) who handcrafts the baby bracelets, building trust and emotional connection with Vietnamese mothers.

## User Stories

### US-1: As a mother visiting the website
**I want to** learn about the person who makes the bracelets  
**So that** I can trust the quality and feel confident purchasing for my baby

**Acceptance Criteria:**
- Section appears after "Cam kết" (Commitments) section and before footer
- Clear heading "Câu chuyện của người làm vòng" with decorative elements
- Personal greeting from the artisan
- Story text that resonates with Vietnamese mothers
- Visual representation (photo) of the artisan

### US-2: As a mobile user
**I want to** easily read the artisan's story on my phone  
**So that** I can learn about the maker while browsing on mobile

**Acceptance Criteria:**
- Mobile layout is vertical (image on top, content below)
- Text is centered and easy to read
- All elements are touch-friendly
- Images load quickly and are optimized

### US-3: As a desktop user
**I want to** see a professional horizontal layout  
**So that** the story feels polished and trustworthy

**Acceptance Criteria:**
- Desktop layout is horizontal (image left 35%, content right 65%)
- Content is left-aligned for better readability
- Proper spacing and visual hierarchy
- Hover effects enhance interactivity

## Design Requirements

### Layout Structure

#### Desktop (≥1024px)
- Horizontal layout
- Image: 35% width, left side
- Content: 65% width, right side
- Image size: 200px × 200px (circular)
- Container: max-width 6xl (1280px)

#### Tablet (769px - 1023px)
- Horizontal layout maintained
- Image: 180px × 180px
- Highlights: 2 columns (wrap if needed)
- Reduced padding and gaps

#### Mobile (≤768px)
- Vertical layout
- Image: 150px × 150px, centered
- Content: centered text alignment
- Highlights: single column, stacked vertically

### Visual Design

#### Color Palette
- Primary: `var(--primary-color)` (orange #f4a261)
- Accent: `var(--accent-color)` (yellow #e9c46a)
- Background: White with warm gradient (#ffffff → #fef9f5)
- Text: Dark gray for body, primary color for headings

#### Typography
- Section title: 2rem (1.5rem mobile), bold, gradient text
- Greeting: 1.5rem (1.25rem mobile), bold, primary color
- Story text: 1.05rem (0.975rem mobile), line-height 1.8
- Highlight titles: 0.95rem, bold
- Highlight text: 0.85rem

#### Borders & Shadows
- Container: 2px dashed border with primary color at 20% opacity
- Border radius: 24px for container, 12px for highlight cards
- Box shadow: Soft shadows with primary color tint
- Image border: 3px solid primary color

#### Spacing
- Section padding: 4rem vertical (desktop), 3rem (mobile)
- Container padding: 2.5rem (desktop), 1.5rem (mobile)
- Gap between image and content: 2.5rem (desktop), 1.5rem (mobile)

### Content

#### Section Title
```
💝 Câu chuyện của người làm vòng
```
With decorative divider (gradient lines + sparkle emoji)

#### Greeting
```
Xin chào mẹ, mình là Anh 👋
```

#### Story Text (2 paragraphs)
```
Là một người mẹ, mình hiểu nỗi lo lắng của mẹ khi chọn đồ cho con. Mỗi sản phẩm cho bé đều phải thật an toàn, thật tốt. Chính vì thế, mỗi chiếc vòng dâu tằm đều được mình làm thủ công bằng đôi tay, tỉ mỉ từng viên hạt, kiểm tra kỹ lưỡng từng chi tiết nhỏ nhất.

Mình không chỉ làm sản phẩm, mình làm với cả trái tim - như đang làm cho chính con mình vậy. Mỗi chiếc vòng đều mang theo lời chúc sức khỏe, bình an của mình dành cho bé nhà mẹ.
```

#### Three Highlights

**1. Thủ công 100%**
- Icon: 🤲
- Title: "Thủ công 100%"
- Text: "Từng viên hạt được xâu tỉ mỉ bằng tay"

**2. Kiểm tra kỹ lưỡng**
- Icon: ✨
- Title: "Kiểm tra kỹ lưỡng"
- Text: "Đảm bảo an toàn tuyệt đối cho bé"

**3. Tâm huyết yêu thương**
- Icon: 💝
- Title: "Tâm huyết yêu thương"
- Text: "Mỗi sản phẩm đều mang theo lời chúc phúc"

### Image Requirements
- Source: `assets/images/profile_img.webp`
- Alt text: "Người làm vòng dâu tằm"
- Format: WebP for optimization
- Display: Circular (border-radius: 50%)
- Border: 3px solid primary color
- Object-fit: cover

## Interaction Design

### Hover Effects

#### Container
- Lift effect: `translateY(-2px)`
- Enhanced shadow on hover
- Smooth transition (0.3s cubic-bezier)

#### Image
- Scale: 1.05 on hover
- Enhanced shadow
- Smooth transition (0.3s ease)

#### Highlight Cards
- Lift effect: `translateY(-4px)`
- Enhanced shadow and border color
- Smooth transition (0.3s ease)

### Animations
- Subtle entrance animations (optional)
- Smooth transitions on all interactive elements
- No jarring or distracting movements

## Technical Requirements

### HTML Structure
```
<section class="artisan-story-section">
  <div class="container">
    <div class="text-center mb-12">
      <h2 class="artisan-story-title">...</h2>
      <div class="decorative-divider">...</div>
    </div>
    <div class="artisan-story-content">
      <div class="artisan-image-wrapper">
        <img class="artisan-image" />
      </div>
      <div class="artisan-text-content">
        <h3 class="artisan-greeting">...</h3>
        <div class="artisan-story">
          <p>...</p>
          <p>...</p>
        </div>
        <div class="artisan-highlights">
          <div class="highlight-card">...</div>
          <div class="highlight-card">...</div>
          <div class="highlight-card">...</div>
        </div>
      </div>
    </div>
  </div>
</section>
```

### CSS Classes
- `.artisan-story-section` - Main section wrapper
- `.artisan-story-title` - Section heading
- `.artisan-story-content` - Content container
- `.artisan-image-wrapper` - Image container
- `.artisan-image` - Circular image
- `.artisan-text-content` - Text content wrapper
- `.artisan-greeting` - Personal greeting
- `.artisan-story` - Story paragraphs
- `.artisan-highlights` - Highlights container
- `.highlight-card` - Individual highlight
- `.highlight-icon` - Emoji icon
- `.highlight-content` - Highlight text wrapper
- `.highlight-title` - Highlight heading
- `.highlight-text` - Highlight description

### Responsive Breakpoints
- Mobile: `max-width: 768px`
- Tablet: `min-width: 769px and max-width: 1024px`
- Desktop: `min-width: 1025px`

### Performance
- Use WebP format for images
- Lazy load images if below fold
- Optimize CSS (no unused styles)
- Smooth animations (use transform/opacity)

## Content Guidelines

### Tone of Voice
- **Warm and personal**: Use "mình" (I) and "mẹ" (mom)
- **Sincere and authentic**: Speak from the heart
- **Relatable**: Reference shared experiences of motherhood
- **Trustworthy**: Emphasize safety and quality
- **Humble**: Avoid boastful language

### Writing Style
- Short, digestible paragraphs
- Simple, clear Vietnamese
- Emotional connection without being overly sentimental
- Focus on benefits for the baby
- Include personal touch (handmade, careful inspection)

### Key Messages
1. **Empathy**: "I understand your concerns as a mother"
2. **Quality**: "Handmade with meticulous attention to detail"
3. **Safety**: "Thoroughly inspected for baby's safety"
4. **Love**: "Made with heart, like for my own child"
5. **Blessing**: "Each bracelet carries wishes for health and peace"

## Success Metrics

### Qualitative
- Builds trust with potential customers
- Creates emotional connection
- Differentiates from mass-produced competitors
- Reinforces handmade, artisan brand positioning

### Quantitative (Future)
- Time spent on page increases
- Scroll depth to this section
- Conversion rate improvement
- Customer feedback mentions personal connection

## Implementation Notes

### File Locations
- HTML: `public/shop/index.html` (after "Cam kết" section, before footer)
- CSS: `public/shop/styles.css` (before Footer section)

### Dependencies
- Existing CSS variables (--primary-color, --accent-color, etc.)
- Existing font families (Quicksand for headings)
- Existing container/grid system

### Browser Support
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Chrome Mobile)
- Graceful degradation for older browsers

## Future Enhancements

### Phase 2 (Optional)
- Video introduction from the artisan
- Customer testimonials integrated
- Behind-the-scenes photos carousel
- Link to detailed "About Us" page
- Social proof (years of experience, number of happy customers)

### Phase 3 (Optional)
- Interactive timeline of the crafting process
- Live chat integration
- Customer photos with their babies wearing bracelets
- Blog posts about baby care and traditions

## Notes
- This section is critical for building trust with Vietnamese mothers
- The personal, handmade aspect is a key differentiator
- Content should be updated periodically to keep fresh
- Consider A/B testing different story variations
- Monitor customer feedback and adjust messaging accordingly
