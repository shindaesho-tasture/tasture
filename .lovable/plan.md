

## Plan: Remove "Satisfaction Rating" Step from Post-Order Review

The "satisfaction" step (5-axis: Texture, Taste, Overall, Cleanliness) is redundant since this data is already captured through Store Review, Dish DNA, and Sensory Feedback steps.

### Changes in `src/pages/PostOrderReview.tsx`:

1. **Remove "satisfaction" from step types** (line 31): Remove `"satisfaction"` from `StepType` union
2. **Remove satisfaction steps from builder** (lines 101-103): Delete the loop that adds satisfaction steps per menu item
3. **Remove satisfaction state** (line 87): Delete `satisfactionScores` / `setSatisfactionScores` state
4. **Remove satisfaction save logic** (lines 439-449): Delete the loop saving to `satisfaction_ratings` table
5. **Remove satisfaction UI block** (lines 947-955): Delete the `{step?.type === "satisfaction" && ...}` JSX block
6. **Remove `SatisfactionStep` component** (lines ~1192-1282): Delete the entire sub-component and its `SatisfactionStepProps` interface
7. **Remove unused `Star` import** (line 12): Clean up the import if only used by satisfaction

This simplifies the flow to: **Store Review -> Dish DNA -> Sensory -> Results** (4 steps instead of 5).

