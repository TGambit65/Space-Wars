# Space Wars 3000 — Launch Marketing Pack

Everything you need to take Space Wars 3000 public. All assets are
production-ready and self-contained inside this `marketing/` folder.

```
marketing/
├── brand/        Logos + brand guide (palette, typography, voice)
├── landing/      Polished launch landing page (open index.html)
├── social/       Key art, OG card, Discord banner, square posts
├── screenshots/  Captures from the running app
├── trailer/      8s cinematic teaser clip (MP4, 16:9, 720p)
├── press_kit/    Fact sheet, description, quotes, asset index
└── copy/         Email, Discord, Twitter, Product Hunt, HN announcements
```

---

## How to use this pack

1. **Brand identity** → `brand/brand_guide.md` is the source of truth for
   colors, type, voice, and logo usage. Drop the CSS variables block into
   any new page to stay on-brand instantly.

2. **Landing page** → `landing/index.html` is a single-file, drop-in
   marketing page. It already references the assets in this folder
   (relative paths). To ship it as your real landing page, either:
   - Open it directly: `marketing/landing/index.html`
   - Or copy the file to `site/launch.html` and link from your existing
     `site/index.html` hero CTA.

3. **Social rollout** → Use `copy/launch_announcements.md` for
   plug-and-play Twitter/X threads, Discord announcement, email blast,
   Product Hunt copy, and a Hacker News "Show HN" post. Replace
   `[LAUNCH_URL]` and `[LAUNCH_DATE]` everywhere.

4. **Press outreach** → Send `press_kit/press_kit.md` plus the assets in
   `brand/` and `social/` as a zip. Update the `[Founder name]` and
   `press@[your-domain]` placeholders first.

5. **Trailer** → `trailer/teaser.mp4` is an 8-second cinematic clip ready
   for embedding on the landing page (already wired) or uploading to
   Twitter, YouTube Shorts, and Discord.

---

## Asset inventory

### Brand
| File | Format | Use |
|---|---|---|
| `brand/logo_full_lockup.png` | 16:9 PNG | Primary logo, web headers, press |
| `brand/logo_icon_mark.png` | 1:1 PNG | Favicon, app icon, avatar, OG corner |
| `brand/logo_mono_white.png` | 16:9 PNG | Single-color print, partner co-marks |
| `brand/brand_guide.md` | Markdown | Colors, type, voice, usage rules |

### Social
| File | Format | Use |
|---|---|---|
| `social/key_art_hero.png` | 16:9 PNG | Main hero image, YouTube thumb, press |
| `social/og_card_background.png` | 16:9 PNG | OG / Twitter card background |
| `social/square_post_cockpit.png` | 1:1 PNG | Instagram, square Twitter, Discord post |
| `social/discord_banner.png` | 16:9 PNG | Discord server banner, channel header |

### Trailer
| File | Format | Use |
|---|---|---|
| `trailer/teaser.mp4` | MP4 720p 16:9 8s | Landing-page hero video, social clips |

### Press
| File | Format | Use |
|---|---|---|
| `press_kit/press_kit.md` | Markdown | Send to press, embed in About page |

### Copy
| File | Format | Use |
|---|---|---|
| `copy/launch_announcements.md` | Markdown | All channel-specific launch text |

### Screenshots
| File | Format | Use |
|---|---|---|
| `screenshots/01_login.jpg` | JPG | Live capture of the Space Wars 3000 login screen |

---

## Pre-launch checklist

- [ ] Replace `[LAUNCH_URL]` in `copy/launch_announcements.md` and `landing/index.html`
- [ ] Replace `[LAUNCH_DATE]`, `[Founder name]`, and `press@[your-domain]` in `press_kit/press_kit.md`
- [ ] Decide whether to use `marketing/landing/index.html` as-is or graduate it into `site/launch.html` for the published deployment
- [ ] Capture 3–5 in-game screenshots (logged in as a demo player) and drop them into `screenshots/`
- [ ] Upload `trailer/teaser.mp4` to YouTube/Twitter for shareable links
- [ ] Schedule the Twitter thread, Discord announcement, and email for launch hour
- [ ] Submit to Product Hunt the night before (uses the copy in `copy/launch_announcements.md`)

Good hunting, Captain.
