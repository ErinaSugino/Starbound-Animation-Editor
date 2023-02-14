# Starbound Animation Editor
A web-based editor to easily create and edit Starbound's .animation files.

Working with custom animations is a powerful tool in Starbound modding. However, due to the lack of any proper documentation on what can and can't be done it's hard to work with. Just like everything else in Starbound, animation files are a finicky matter and the slightest error can crash the entire game.
Furthermore, in a project heavily relying on complex custom animations a single animation file can get unmangably huge easily due to the need to hardcode everything you might need at any given point into the file, so that Starbound can read and load it at startup - because there is very little you can change in-game after the fact.

This lead to the personal need of a better way to manage a roughtly 10.000 lines long animation file, and after not finding any dedicated tools for this matter I decided to create my own.

## Web Application
The `Starbound Animation Editor` is a web-based application for two major reasons.
One: I'm primarily a web-developer and working with JavaScript and co. is just several times easier than writing an actual program. After all, your browser deals with all the UI rendering, input management and security stuff all by itself.
Two: Instead of having a compiled program that you need to run, a web-application like this one is available to anyone who has a modern browser with no further dependencies required - something anyone actually planning on working with animations in Starbound should have at least one of in the first place. No matter if run offline on your Desktop or via a remote webserver, it's as simple as can be.

## Features
The `Starbound Animation Editor` supports every feature Starbound itself accepts in an animation file, *based off of my own reverse engineering from what works in official game assets and other projects.* If there is anything not yet supported or a misunderstanding in how things work, create an [Issue](/../../issues) to let me know.

Currently supported features:
- Global Tags
- Parts, Part States & Frame States
- State Types & States
- Particle Emitters (file reference and inline)
- Transformation Groups
- Sound Pools
- Rich preview and minifying output options

Currently **not** supported features:
- Light sources (missing information)
