# autolearn-marathon-agent
An autonomous AI agent that plans, executes, verifies, and self-repairs tasks end-to-end. Built for hackathons to demonstrate long-running reasoning, execution loops, and self-correction.

🚀 AutoLearn Marathon Agent

Beyond Automation.
An autonomous AI agent that plans, executes, verifies, and self-repairs until a goal is achieved.

🧠 What It Is

AutoLearn Marathon Agent is not a chatbot.
It is a long-running autonomous agent system built with Gemini 3 that:
Breaks high-level goals into steps
Executes them sequentially
Verifies outputs against requirements
Detects failures and retries automatically
Produces structured artifacts and progress logs
All behavior is visible in a real-time control panel UI.

✨ Why It’s Interesting

True autonomous execution loop (planner → executor → verifier → fixer)
Built-in failure detection & self-correction
Designed for real-world constraints (API limits, retries, degradation)
Clear visualization of agent reasoning without hidden magic

🛠️ How It Was Built

Frontend: React + TypeScript
Agent Engine: Modular autonomous pipeline
AI Model: Gemini 3 (Free Tier compatible)
Design: Custom dark-mode AI control dashboard

🚧 Key Challenge

Handling rate limits (429 errors) during long missions while keeping the agent autonomous, transparent, and safe from infinite loops.

🏆 What We’re Proud Of

A real autonomous agent, not prompt automation
Clear separation of planning, execution, and verification
Judge-friendly UI that shows what the agent is doing and why

🔮 What’s Next

Persistent memory across sessions
Tool/plugin execution
Multi-agent collaboration
