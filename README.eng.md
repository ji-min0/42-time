# 42 time

> [한국어](./README.md)

A browser extension that shows your logtime at a glance on the 42 intra (v3) profile.
No more hovering over calendar cells and doing mental math to figure out how far you
are from your piscine hour goal 🙌

## What does it show?

- **Progress**: accumulated hours / goal, progress bar, how much you're short
- **Daily average**: how many hours per day, starting today, to hit your goal
- **Weekly / monthly totals**: aggregated by calendar week (Sun–Sat) and by month
- **Weekly goal mode**: for people with per-week requirements like "40h every week"
  (e.g. KNU field training). Weeks you made get a ✓, weeks you missed get a ✕
- **Skip days/dates**: resting on Sundays? Exam day doesn't count? Exclude them
  from the daily average
- **KO/EN toggle**, collapse button, and settings that save the moment you change them

## Installation (Chrome / Edge / any Chromium browser)

It's not on the web store, so you load it in developer mode — takes about a minute.

1. Download this repo (green **Code** button → **Download ZIP** → unzip,
   or `git clone`)
2. Go to `chrome://extensions` in your address bar
   (`edge://extensions` on Edge)
3. Turn on the **Developer mode** switch (top right; left side on Edge)
4. Click **Load unpacked** → select the unzipped folder
5. Visit [profile-v3.intra.42.fr](https://profile-v3.intra.42.fr) while logged in!

If a panel shows up in the bottom-right corner, you're done. If it says
"waiting for logtime data", scroll until the logtime calendar is visible.

## Usage

- **⚙ Settings**: change the period (start/end dates), goal (h), weekly goal (h),
  and skip days/dates. No save button — changes apply and persist instantly.
- **Goal (h)**: put 120 for a piscine. Leave it empty to just track hours with no goal.
- **Weekly goal (h)**: if you have a per-week requirement, put it here (e.g. 40).
  With the total goal empty and only a weekly goal set, the top progress bar switches
  to "this week" and resets every week.
- **한/EN**: toggle the language from the header
- **−**: collapse the panel (the hours/goal summary stays visible)

## How does it work?

The extension detects the data the intra profile page fetches to draw the logtime
calendar and aggregates it directly. No API keys, no extra login, and nothing leaves
your browser. Settings are stored in `chrome.storage.sync`.

## Contributing 🎉

- ⭐ Stars are always appreciated
- Bugs and ideas? Open an issue anytime
- Digging through the code is more than welcome — fork it and hack away
- PRs welcome too!

## Troubleshooting

- **No panel**: hit refresh (🔄) on the extension in `chrome://extensions`,
  then refresh the intra page
- **Stuck on "waiting for logtime data"**: scroll so the logtime calendar is on
  screen. Still stuck? Please open an issue (attaching the F12 console output helps a lot)
- **Numbers differ from the calendar by a few minutes**: likely day-boundary handling
  of sessions that cross midnight. The totals match.