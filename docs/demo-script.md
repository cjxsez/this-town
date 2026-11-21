# Demo script (about 3 minutes)

Setup: two kiosks on the table labeled **car 1412** and **car 1413** (the second can be a Pi with no screen, or just a tag + LED strip). Two riders: one wearing the glasses, one teammate as "Maya". Ghost riders running (`pnpm ghosts`) so the kiosks show a few riders on the train.

1. **Onboarding (20 s).** Show the 5 quick phone screens. Link glasses: the lens shows `4821`, type it on the phone.
2. **Board (20 s).** Tap the car 1412 tag. Banner pops, tap it, pick destination "Downtown Crossing". Kiosk idle screen ticks up "3 riders in this car".
3. **Match (30 s).** Maya taps in on car 1413. Glasses: "Maya, kiosk 1 car forward, look for orange. You both love ramen and film." Car 1413's LEDs glow orange. Maya stays put, you walk.
4. **Mission (40 s).** At the kiosk, the screen shows "Rename Downtown Crossing. Best name wins." with a countdown to the next stop. Glasses show the compact version.
5. **Stamp (20 s).** The Pi rewrites the tag. Both tap and confirm. Kiosk celebrates in orange, glasses show the stamp.
6. **Late bonus (20 s).** Trigger a scripted delay. Rare mission unlocks in purple.
7. **Close (20 s).** Passport on the phone. Line: "The phone decides who. The glasses and the kiosk make it happen."

Fallbacks: if the glasses misbehave, open `/g/` in a 600x600 browser window on the laptop. If the dynamic tag fails, swap in the static sticker.
