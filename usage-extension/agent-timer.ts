/**
 * agent-timer — Persistent status bar display showing agent duration.
 *
 * - During an active session: "● Agent · 2h 35m" (updates every second)
 * - Uses a hidden widget to capture the tui reference for requestRender()
 * - On shutdown: persists duration, shows "○ Last run: 2h 35m"
 */

import type { ExtensionAPI, ExtensionCommandContext, Theme } from "@earendil-works/pi-coding-agent";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

// =============================================================================
// Types
// =============================================================================

interface LastRunData {
	sessionId: string;
	startTime: number;
	endTime: number;
	durationMs: number;
}

// =============================================================================
// Persistence
// =============================================================================

function getLastRunFilePath(): string {
	const agentDir = process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent");
	return join(agentDir, ".usage-extension-last-run.json");
}

async function writeLastRun(data: LastRunData): Promise<void> {
	try {
		await writeFile(getLastRunFilePath(), JSON.stringify(data), "utf8");
	} catch {
		// Best-effort persistence
	}
}

// =============================================================================
// Duration formatting
// =============================================================================

export function formatDuration(ms: number): string {
	if (ms < 0) return "0s";
	const totalSeconds = Math.floor(ms / 1000);
	const days = Math.floor(totalSeconds / 86400);
	const hours = Math.floor((totalSeconds % 86400) / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	if (days > 0) return `${days}d ${hours}h ${minutes}m`;
	if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
	if (minutes > 0) return `${minutes}m ${seconds}s`;
	return `${seconds}s`;
}

export function formatTimeAgo(ms: number): string {
	if (ms < 0) return "just now";
	const totalSeconds = Math.floor(ms / 1000);
	const days = Math.floor(totalSeconds / 86400);
	const hours = Math.floor((totalSeconds % 86400) / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	if (days > 0) return `${days}d ago`;
	if (hours > 0) return `${hours}h ago`;
	if (minutes > 0) return `${minutes}m ago`;
	return `${seconds}s ago`;
}

// =============================================================================
// Timer state machine
// =============================================================================

export function setupAgentTimer(pi: ExtensionAPI): void {
	let durationTimer: ReturnType<typeof setInterval> | null = null;
	let accumulatedMs = 0;
	let currentTurnStart = 0;
	let sessionId = "";
	let tuiRef: { requestRender: () => void } | null = null;
	let ctxRef: ExtensionCommandContext | null = null;

	const requestRender = (): void => {
		tuiRef?.requestRender();
	};

	const activeMs = (): number =>
		currentTurnStart > 0 ? Date.now() - currentTurnStart : accumulatedMs;

	const updateAgentStatus = (): void => {
		if (!ctxRef) return;
		const theme = ctxRef.ui.theme;
		const d = formatDuration(activeMs());
		ctxRef.ui.setStatus(
			"usage-agent-timer",
			theme.fg("accent", "●") + " " + theme.fg("accent", theme.bold("Agent")) + " " + theme.fg("dim", d),
		);
	};

	const startInterval = (): void => {
		if (durationTimer) return;
		durationTimer = setInterval(() => {
			updateAgentStatus();
			requestRender();
		}, 1000);
	};

	const stopInterval = (): void => {
		if (durationTimer) {
			clearInterval(durationTimer);
			durationTimer = null;
		}
	};

	pi.on("session_start", async (_event, ctx) => {
		ctxRef = ctx;
		accumulatedMs = 0;
		currentTurnStart = 0;
		sessionId = ctx.sessionManager?.getSessionId?.() ?? "";

		// Hidden widget to capture tui reference — same pattern as pi-interactive-shell
		ctx.ui.setWidget(
			"usage-agent-timer-widget",
			(tui: { requestRender: () => void }, _theme: Theme) => {
				tuiRef = tui;
				return { render: () => [], invalidate: () => {} };
			},
		);

		// Show initial idle status (0s until first turn)
		updateAgentStatus();
	});

	pi.on("turn_start", async () => {
		currentTurnStart = Date.now();
		startInterval();
		updateAgentStatus();
	});

	pi.on("turn_end", async () => {
		if (currentTurnStart > 0) {
			accumulatedMs += Date.now() - currentTurnStart;
			currentTurnStart = 0;
		}
		updateAgentStatus();
		stopInterval();
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		stopInterval();
		tuiRef = null;
		ctxRef = null;
		ctx.ui.setWidget("usage-agent-timer-widget", undefined);

		// Capture any active turn before finalizing
		if (currentTurnStart > 0) {
			accumulatedMs += Date.now() - currentTurnStart;
			currentTurnStart = 0;
		}

		if (accumulatedMs > 0) {
			// Persist for next startup
			await writeLastRun({
				sessionId,
				startTime: Date.now() - accumulatedMs,
				endTime: Date.now(),
				durationMs: accumulatedMs,
			});

			// Replace running status with "last run" info
			const theme = ctx.ui.theme;
			const d = formatDuration(accumulatedMs);
			ctx.ui.setStatus(
				"usage-agent-timer",
				theme.fg("dim", "○") + " " + theme.fg("dim", "Last run:") + " " + d,
			);
		}

		accumulatedMs = 0;
		sessionId = "";
	});
}
