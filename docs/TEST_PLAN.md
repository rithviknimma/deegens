# Manual test plan (before sending the link)

Do these in order. "Friend" means a **private/incognito window** (or a second phone): it acts as a separate person.
Note anything that fails and we'll go through it together.

## A. Joining

1. **Rules before login.** Open the site. On the Join screen, tap *How it works →*.
   ✅ Rules page shows with a *Back* link; numbers match the points we agreed (5 / 2 / 10 / 15 / 25 / 10). App is named **deegens**.
2. **Wrong passcode.** Join tab: wrong passcode, name `Rithvik`, PIN `123456`.
   ✅ "Wrong passcode". Nothing else happens.
3. **Join as admin.** Same form with the correct passcode.
   ✅ You land on Picks. Top bar shows Picks / Group / Rules / **Admin** and your name.
4. **Friend joins.** In the friend window, join as `TestFriend`, PIN `111111`.
   ✅ Friend lands on Picks. Top bar has **no** Admin tab.
5. **Duplicate name.** Third window (or log out the friend): join as `rithvik` (lowercase).
   ✅ "That name is taken…"

## B. Making picks (do on your phone)

6. **Countdown.** Banner at the top shows time until lock and the date (Tue Oct 20).
7. **Drag to reorder.** Drag a team by the ⠿ handle to a new spot.
   ✅ Moves smoothly, **only up/down** (dragging sideways doesn't shift the row); the page still scrolls normally when you swipe anywhere else.
8. **Arrow buttons.** Tap ▲/▼ on a team. ✅ Moves one spot. ▲ is disabled on #1, ▼ on #15.
9. **Markers.** ✅ Seeds 7–10 show a small *PLAY-IN* tag; a *Playoff line* divider sits after 8.
10. **East/West tabs.** Reorder East, switch to West, switch back. ✅ East order is kept.
11. **#1 seeds.** ✅ The Playoffs section names your current #1 East and West teams and updates when you reorder.
12. **Champion choice.** Pick East and West champs. ✅ Two buttons appear for NBA champ. Pick one, then change the East champ → ✅ champ resets if it was the old East team.
13. **Autocomplete.** Tap MVP and type `shai`. ✅ A list opens under the field showing *Shai Gilgeous-Alexander · OKC*; tap it → field fills and the keyboard closes.
14. **Accents + partial names.** Type `jokic` → ✅ *Nikola Jokić* appears. Type `wemb` → ✅ *Victor Wembanyama*.
15. **Lists are filtered.** In ROY type `lebron` → ✅ "No matches" (rookies only). In COY, type a coach's last name → ✅ only coaches.
16. **Typing without choosing.** Type `xyz` in DPOY and tap elsewhere → ✅ field reverts (nothing saved). Tap × on a filled award → ✅ it clears.
17. **Save.** Tap *Save picks*. ✅ "Saved ✓". Bottom bar says "All changes saved" and the remaining-picks count is right.
18. **Unsaved warning.** Reorder a team, then try to refresh/close the tab. ✅ Browser asks if you want to leave.
19. **Persistence.** Refresh. ✅ Your order and picks are exactly as saved.

## C. Privacy before the lock

20. **Group status.** Friend saves only seeding. (As the friend, before the lock: tap **View** next to your admin's name → popup says *Hidden until opening night!* with a countdown; tap View on yourself → your own picks.) On your Group tab:
    ✅ Both names listed; friend shows *Seeding ✓* and *Picks 0/9*. **No team picks visible.**

## D. Logging in elsewhere

21. **Log out.** Tap your name (↩) in the top bar. ✅ Back to the Join screen.
22. **Wrong PIN.** Log in tab, `Rithvik` + wrong PIN. ✅ "Wrong name or PIN".
23. **Log in.** Correct PIN, name typed as ` rithvik ` (lowercase, spaces). ✅ Logged in as Rithvik, picks intact.
24. **Second device.** Log in on your laptop as well. ✅ Same picks on both; both stay logged in.
25. **Lockout.** In the friend window, log out and enter a wrong PIN for TestFriend 5 times.
    ✅ 6th try says "Wait 15 minutes."

## E. Admin page

26. **Reset PIN.** Admin → Members → *Reset PIN* on TestFriend → `222222`.
    ✅ Friend can log in immediately with `222222` (lockout cleared).
27. **Lock times.** ✅ Preseason lock shows Oct 20 in your local time. (Don't change it.)
28. **Bad passcode change.** Enter a 5-character passcode. ✅ Refused (8+ characters).

## F. The lock (simulate safely)

The app won't let anyone move a lock that has passed, so simulate it from Supabase:

29. **Lock it.** Supabase → SQL Editor:
    `update seasons set lock_at = now() where id = '2026-27';`
    Refresh the app.
    ✅ Picks page is read-only with 🔒 banner; no Save bar. Group tab shows everyone's **League-Wide Seeding** grid (sorted by group average) and **League-Wide Picks** table. Tap **View** next to a friend in Who's in: a popup shows their East and West seeding (side by side on desktop, stacked on phone) and their picks with logos and headshots.
30. **Late joiner.** In a fresh private window, join as `LateTest`.
    ✅ Picks page says preseason picks are closed.
31. **Admin can't reopen.** Admin page → change the preseason lock to tomorrow → Save.
    ✅ Error: "already locked and revealed; the lock can't be moved".
32. **Unlock again.** SQL Editor:
    `update seasons set lock_at = '2026-10-20 19:00:00+00' where id = '2026-27';`
    ✅ App is editable again and Group hides picks again.

## G. Clean up

33. Admin → Members → *Remove* TestFriend and LateTest. ✅ They disappear from Group.
34. Confirm the lock is back to Tue Oct 20 (test 32). **Then share the link + passcode.**
