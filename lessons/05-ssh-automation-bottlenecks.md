# Lesson 5: SSH Automation Bottlenecks

## The Conflict
Rhea relies on Tailscale SSH for zero-config private networking between clients and servers.

## What Failed
In automated environments (like a CLI tool), SSH password prompts are a "dead end." If the user hasn't configured SSH keys or Tailscale SSH's "Check" mode correctly, the entire RPC flow hangs silently.

## The Lesson
Always implement a "Status" or "Doctor" command that fails fast. Rhea's `status` command was critical for identifying when a connection was stuck on a password prompt rather than just being "offline." Automation should never assume the transport is transparent.
