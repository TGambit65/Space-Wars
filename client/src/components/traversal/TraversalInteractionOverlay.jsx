function TraversalInteractionOverlay({
  activeInteraction,
  recentAction = null,
  previewMode = false,
}) {
  if (previewMode && !recentAction) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-20 flex flex-col items-center gap-3">
      {!previewMode && activeInteraction && (
        <div className="rounded-2xl border border-cyan-300/30 bg-slate-950/75 px-4 py-3 text-center shadow-[0_0_24px_rgba(0,255,255,0.08)] backdrop-blur-sm">
          <div className="text-[10px] uppercase tracking-[0.28em] text-cyan-200/70">
            {activeInteraction.label}
          </div>
          <div className="mt-1 text-sm text-white">
            {activeInteraction.prompt}
          </div>
          <div className="mt-1 text-[11px] text-cyan-100/70">
            Press <span className="font-semibold text-cyan-100">E</span> or <span className="font-semibold text-cyan-100">A</span>
          </div>
        </div>
      )}

      {recentAction && (
        <div className="max-w-md rounded-full border border-amber-300/30 bg-amber-500/10 px-4 py-2 text-[11px] uppercase tracking-[0.22em] text-amber-100/85 backdrop-blur-sm">
          {recentAction}
        </div>
      )}
    </div>
  );
}

export default TraversalInteractionOverlay;
