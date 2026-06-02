---
"live-mobile": patch
---

Fix the Swap history "Previous" button playing the forward (push) transition instead of the back (pop) one in Wallet 4.0. The history sub-screen is pushed on top of Main, so we now pop the parent navigator instead of resetting it, restoring the correct left-to-right back animation. Swap success now also routes Android system back and iOS swipe-back to the Swap input screen, while still allowing the success screen to open history, so users cannot return to the unavailable processing screen.
