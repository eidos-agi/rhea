# Lesson 4: Headless Image Generation Realities

## The Conflict
The goal was to enable one-liner image generation from the terminal to save on expensive web-based token usage.

## What Failed
Most official CLIs (like Gemini or Claude) are optimized for text-based REPL interactions. Capturing binary image data from a headless shell command is often unsupported or requires custom extensions that may be missing or broken in the target environment (e.g., the missing `nanobanana` config).

## The Lesson
To make image generation reliable, Rhea needed its own binary-aware adapter (`@rhea/images`). Don't rely on the "default" behavior of a general-purpose AI CLI if you need specific binary outputs like PNGs; build a dedicated script or SDK wrapper instead.
