FETCH BOY — macOS Installation Note
=====================================

Fetch Boy is not yet signed with an Apple Developer certificate. Because of
this, macOS Gatekeeper will block the app from opening and show a "damaged"
error message. The app is NOT damaged — this is an Apple security restriction
on unsigned applications.

HOW TO OPEN FETCH BOY
---------------------

After dragging Fetch Boy to your Applications folder, open Terminal and run:

    xattr -cr /Applications/Fetch\ Boy.app

Then launch the app normally from your Applications folder or Spotlight.

You only need to do this once.

WHY IS THIS NECESSARY?
----------------------

Apple requires a paid Developer account ($99/year) to sign and notarize apps
for distribution. Fetch Boy is an open source project and is not yet enrolled
in the Apple Developer Program.

If you would like to help fund signing, please visit the project on GitHub.

QUESTIONS OR ISSUES
-------------------

https://github.com/dominicjomaa/fetch-boy/issues
