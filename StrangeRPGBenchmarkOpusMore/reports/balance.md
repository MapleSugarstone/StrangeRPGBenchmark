# Please Hold balance report

The headless simulator in src/sim produced this report with seed 1 and 200 trials per boss variant. It walks the campaign with a casual player, saves the state in front of each boss, and replays each boss many times with several play styles.

## What the metrics mean

Each boss is replayed by these policies.

- smart: simulates the next 6 actions for every candidate move and takes the best one. It listens to unknown enemies once, heals allies under 35 percent, answers enemies whose ask it knows, and uses Rewind and Line when they help. It succeeds at timing 80 percent of the time.
- casual: attacks the weakest foe 55 percent of the time, uses a random damaging skill 25 percent of the time, heals when an ally is under 30 percent, answers a listened enemy 10 percent of the time, and otherwise acts at random. It succeeds at timing 50 percent of the time.
- mash: attacks the weakest foe and uses a healing item when an ally is under 25 percent. It succeeds at timing 30 percent of the time.
- random: picks any legal action and never times anything.
- attack: always attacks the weakest foe with good timing (80 percent). It exists to detect a dominant strategy.
- smart-noMech, casual-noMech, and smart-noTiming: the smart or casual policy without the chapter mechanic, and the smart policy without clean hits and braces.

The metrics are defined as follows.

- Win rate: the share of trials the party wins. A fight that reaches 200 actions counts as a loss.
- Actions and party turns: actions by both sides, and the part of them taken by the party. Final HP: the party HP fraction at the end.
- Lead: the party HP fraction minus the enemy HP fraction after each action. Lead changes: how often the leader flips, divided by actions minus 1.
- Drama: in won fights, the mean deficit over the actions where the party trailed. Killer move: the largest swing in the lead from one action.
- Comeback: the share of wins where the lead fell below -0.3. Near-miss: the share of wins that ended under 15 percent party HP. Tension: the share of wins that were either.
- KOs: party members knocked out per fight. Decisiveness: the share of the fight that remained after the leader stopped changing.
- Entropy: the Shannon entropy of the smart action mix divided by the log of the number of action types the party can use (capped at 6). One action type above 60 percent of actions is flagged.
- Attack-only gap: the smart win rate minus the attack-only win rate. Mechanic drop: the smart win rate minus the win rate without the chapter mechanic. A mechanic that is a skill, such as Listen, is removed by taking the skill away and clearing what the player has learned about enemies.

The campaign walk follows these rules.

- Joins and the shop run at the start of the chapter, and a second shop pass for unbought items runs before each boss.
- Regular fights are shuffled, the rests are spread evenly, and the party rests before each boss.
- A lost fight restores the earlier state and retries up to 5 times. After 5 failures the fight is skipped with full rewards and flagged.
- Enemies that need a key item find it in the inventory.
- Smart reads an enemy ask or weak spot only after it listened to that enemy type, when the enemy is a kept prayer, or when the casual walk listened to that type earlier.

## Fun Index formula

- Each part scores from 0 to 1 and the Fun Index is 100 times the weighted sum (weights add up to 1).
- near(x, t, w) = max(0, 1 - |x - t| / w). band(x, lo, hi, w) is 1 inside [lo, hi] and falls to 0 linearly over a distance w outside it.
- challenge (weight 0.20) = 0.5 * near(smart boss win rate, 0.85, 0.4) + 0.5 * near(casual boss win rate, 0.60, 0.4).
- tension (0.15) = near(share of casual boss wins that are comebacks or near-misses, 0.25, 0.25).
- lead (0.10) = near(mean lead changes per action in casual boss fights, 0.20, 0.20).
- variety (0.15) = min(1, normalized action entropy of the smart policy / 0.6), halved when one action type exceeds 60 percent of actions.
- relevance (0.15) = score of d, the larger of the smart and casual win rate drops in points when the chapter mechanic is removed: d / 5 below 5, 1 from 5 to 25, and 1 - (d - 25) / 25 above 25 (never below 0). A boss that must be answered in the Answer chapter uses d = 15 because the mechanic is required by design.
- pacing (0.15) = 0.5 * band(mean actions in regular fights, 6, 14, 6) + 0.5 * band(mean actions in smart boss fights, 20, 45, 15).
- novelty (0.10) = min(1, novelty per 10 minutes / 3), where novelty counts new enemy types, 1 for the new mechanic, and new party members.

Weights: challenge 20, tension 15, lead 10, variety 15, relevance 15, pacing 15, novelty 10.

## Chapter 1: Hello?

Fun Index 72.1 of 100. Parts: challenge 0.49, tension 0.70, lead 0.88, variety 1.00, relevance 0.20, pacing 1.00, novelty 1.00.

| Measure | Value |
| --- | --- |
| Estimated play time | 17.2 minutes |
| Novelty | 10 new things, 5.8 per 10 minutes |
| Casual walk retries | 1 (0 stuck) |
| Regular fight length | 10.0 actions, 27% party HP lost per fight |

### Boss want

Party level 5.0 against boss level 5. Attack-only gap 0.73. Mechanic drop 1.0 points, or 6.6 points of final party HP. Timing drop 30.0 points. Smart entropy 1.00, top action attack at 27%. Smart Rewinds per fight 0.00.

| Variant | Win rate | Actions | Party turns | Final HP | Lead changes | Drama | Killer move | Comeback | Near-miss | Tension | KOs | Decisiveness |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| smart | 0.99 | 34.7 ± 7.8 | 23.5 ± 5.1 | 0.79 | 0.09 | 0.12 | 0.30 | 3% | 1% | 3% | 0.02 | 0.79 |
| casual | 0.86 | 34.5 ± 7.2 | 22.7 ± 4.8 | 0.43 | 0.18 | 0.11 | 0.35 | 31% | 2% | 33% | 0.71 | 0.48 |
| mash | 0.38 | 31.6 ± 7.0 | 19.4 ± 4.8 | 0.13 | 0.22 | 0.13 | 0.36 | 48% | 19% | 52% | 2.10 | 0.30 |
| random | 0.01 | 40.2 ± 10.2 | 25.9 ± 6.8 | 0.00 | 0.10 | 0.12 | 0.38 | 0% | 0% | 0% | 2.50 | 0.55 |
| attack | 0.26 | 23.7 ± 2.2 | 14.1 ± 1.7 | 0.05 | 0.26 | 0.07 | 0.29 | 2% | 35% | 35% | 1.59 | 0.32 |
| smart-noMech | 0.99 | 39.3 ± 8.4 | 24.6 ± 5.0 | 0.73 | 0.08 | 0.10 | 0.31 | 2% | 1% | 3% | 0.04 | 0.82 |
| casual-noMech | 0.85 | 34.6 ± 7.7 | 22.6 ± 5.0 | 0.43 | 0.18 | 0.11 | 0.35 | 28% | 4% | 29% | 0.71 | 0.49 |
| smart-noTiming | 0.69 | 48.6 ± 13.5 | 32.3 ± 8.3 | 0.39 | 0.11 | 0.13 | 0.37 | 18% | 6% | 23% | 1.09 | 0.55 |

## Chapter 2: Please Hold

Fun Index 76.3 of 100. Parts: challenge 0.64, tension 0.05, lead 0.77, variety 1.00, relevance 1.00, pacing 1.00, novelty 1.00.

| Measure | Value |
| --- | --- |
| Estimated play time | 19.1 minutes |
| Novelty | 9 new things, 4.7 per 10 minutes |
| Casual walk retries | 0 (0 stuck) |
| Regular fight length | 13.2 actions, 29% party HP lost per fight |

### Boss bigger

Party level 9.0 against boss level 8. Attack-only gap not applicable because the boss must be answered. Mechanic drop 100.0 points, or -7.5 points of final party HP. Timing drop 0.0 points. Smart entropy 1.00, top action attack at 20%. Smart Rewinds per fight 0.00.

| Variant | Win rate | Actions | Party turns | Final HP | Lead changes | Drama | Killer move | Comeback | Near-miss | Tension | KOs | Decisiveness |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| smart | 1.00 | 26.1 ± 3.9 | 19.3 ± 2.8 | 0.84 | 0.12 | 0.09 | 0.48 | 2% | 0% | 2% | 0.00 | 0.64 |
| casual | 0.74 | 43.1 ± 8.9 | 30.5 ± 6.3 | 0.21 | 0.15 | 0.13 | 0.29 | 41% | 17% | 49% | 1.16 | 0.22 |
| mash | 0.00 | 76.2 ± 72.4 | 48.1 ± 43.9 | 0.02 | 0.08 | 0.00 | 0.24 | 0% | 0% | 0% | 2.52 | 0.47 |
| random | 0.00 | 28.0 ± 5.7 | 18.9 ± 4.1 | 0.00 | 0.00 | 0.00 | 0.31 | 0% | 0% | 0% | 2.21 | 0.95 |
| attack | 0.00 | 109.4 ± 85.3 | 68.4 ± 53.7 | 0.04 | 0.09 | 0.00 | 0.20 | 0% | 0% | 0% | 1.31 | 0.65 |
| smart-noMech | 0.00 | 200.0 ± 0.0 | 145.3 ± 0.7 | 0.92 | 0.02 | 0.00 | 0.21 | 0% | 0% | 0% | 0.01 | 0.95 |
| casual-noMech | 0.00 | 188.0 ± 42.0 | 131.4 ± 30.3 | 0.40 | 0.04 | 0.00 | 0.23 | 0% | 0% | 0% | 0.61 | 0.81 |
| smart-noTiming | 1.00 | 39.0 ± 6.2 | 28.7 ± 4.5 | 0.77 | 0.13 | 0.10 | 0.48 | 5% | 0% | 5% | 0.00 | 0.53 |

## Chapter 3: The Docket

Fun Index 78.5 of 100. Parts: challenge 0.49, tension 0.58, lead 0.54, variety 1.00, relevance 1.00, pacing 0.97, novelty 1.00.

| Measure | Value |
| --- | --- |
| Estimated play time | 18.9 minutes |
| Novelty | 10 new things, 5.3 per 10 minutes |
| Casual walk retries | 0 (0 stuck) |
| Regular fight length | 10.8 actions, 10% party HP lost per fight |

### Boss supervisor

Party level 13.0 against boss level 13. Attack-only gap 0.97. Mechanic drop 12.5 points, or -1.8 points of final party HP. Timing drop 0.0 points. Smart entropy 1.00, top action attack at 11%. Smart Rewinds per fight 0.00.

| Variant | Win rate | Actions | Party turns | Final HP | Lead changes | Drama | Killer move | Comeback | Near-miss | Tension | KOs | Decisiveness |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| smart | 1.00 | 19.2 ± 4.9 | 16.2 ± 4.0 | 0.90 | 0.09 | 0.09 | 0.44 | 3% | 0% | 3% | 0.04 | 0.70 |
| casual | 0.86 | 42.2 ± 9.8 | 30.9 ± 6.9 | 0.43 | 0.11 | 0.11 | 0.40 | 33% | 6% | 35% | 2.30 | 0.49 |
| mash | 0.01 | 32.8 ± 7.0 | 22.1 ± 5.3 | 0.00 | 0.09 | 0.10 | 0.40 | 67% | 67% | 100% | 3.96 | 0.54 |
| random | 0.00 | 29.9 ± 7.5 | 21.5 ± 5.5 | 0.00 | 0.02 | 0.00 | 0.51 | 0% | 0% | 0% | 4.54 | 0.86 |
| attack | 0.03 | 33.9 ± 4.7 | 23.1 ± 3.4 | 0.00 | 0.11 | 0.05 | 0.33 | 0% | 60% | 60% | 3.94 | 0.50 |
| smart-noMech | 1.00 | 20.8 ± 4.8 | 18.0 ± 4.0 | 0.92 | 0.07 | 0.08 | 0.45 | 3% | 0% | 3% | 0.04 | 0.71 |
| casual-noMech | 0.73 | 47.2 ± 8.6 | 35.3 ± 6.4 | 0.30 | 0.12 | 0.11 | 0.41 | 47% | 12% | 52% | 3.71 | 0.36 |
| smart-noTiming | 1.00 | 24.3 ± 6.2 | 20.3 ± 4.9 | 0.88 | 0.10 | 0.11 | 0.44 | 23% | 0% | 23% | 0.17 | 0.59 |

## Chapter 4: Encore

Fun Index 76.4 of 100. Parts: challenge 0.51, tension 0.66, lead 0.60, variety 1.00, relevance 0.80, pacing 0.89, novelty 1.00.

| Measure | Value |
| --- | --- |
| Estimated play time | 18.1 minutes |
| Novelty | 9 new things, 5.0 per 10 minutes |
| Casual walk retries | 0 (0 stuck) |
| Regular fight length | 7.8 actions, 14% party HP lost per fight |

### Boss bedtime

Party level 16.8 against boss level 16. Attack-only gap 0.61. Mechanic drop 4.0 points, or 0.3 points of final party HP. Timing drop 0.0 points. Smart entropy 1.00, top action line at 9%. Smart Rewinds per fight 0.03.

| Variant | Win rate | Actions | Party turns | Final HP | Lead changes | Drama | Killer move | Comeback | Near-miss | Tension | KOs | Decisiveness |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| smart | 1.00 | 16.8 ± 3.8 | 13.4 ± 2.8 | 0.89 | 0.11 | 0.06 | 0.44 | 0% | 0% | 0% | 0.01 | 0.68 |
| casual | 0.84 | 39.0 ± 8.3 | 26.1 ± 5.2 | 0.38 | 0.12 | 0.08 | 0.26 | 7% | 11% | 17% | 1.57 | 0.52 |
| mash | 0.12 | 37.5 ± 6.4 | 23.5 ± 5.8 | 0.02 | 0.14 | 0.08 | 0.24 | 4% | 67% | 67% | 3.73 | 0.42 |
| random | 0.03 | 37.2 ± 8.0 | 24.7 ± 6.1 | 0.01 | 0.03 | 0.19 | 0.30 | 100% | 17% | 100% | 4.09 | 0.82 |
| attack | 0.39 | 36.9 ± 3.0 | 23.3 ± 2.9 | 0.05 | 0.18 | 0.05 | 0.20 | 0% | 61% | 61% | 3.15 | 0.26 |
| smart-noMech | 1.00 | 16.8 ± 3.9 | 13.4 ± 2.8 | 0.89 | 0.11 | 0.06 | 0.44 | 0% | 0% | 0% | 0.01 | 0.67 |
| casual-noMech | 0.81 | 38.9 ± 8.2 | 25.8 ± 5.3 | 0.37 | 0.12 | 0.08 | 0.26 | 6% | 9% | 14% | 1.79 | 0.51 |
| smart-noTiming | 1.00 | 19.9 ± 5.5 | 16.0 ± 4.2 | 0.87 | 0.12 | 0.08 | 0.45 | 1% | 0% | 1% | 0.03 | 0.57 |

## Chapter 5: Jackpot

Fun Index 69.8 of 100. Parts: challenge 0.53, tension 0.50, lead 0.61, variety 1.00, relevance 0.50, pacing 0.87, novelty 1.00.

| Measure | Value |
| --- | --- |
| Estimated play time | 16.8 minutes |
| Novelty | 9 new things, 5.3 per 10 minutes |
| Casual walk retries | 0 (0 stuck) |
| Regular fight length | 11.0 actions, 21% party HP lost per fight |

### Boss house

Party level 19.5 against boss level 20. Attack-only gap 0.25. Mechanic drop 2.5 points, or 0.0 points of final party HP. Timing drop 0.0 points. Smart entropy 1.00, top action item at 12%. Smart Rewinds per fight 0.30.

| Variant | Win rate | Actions | Party turns | Final HP | Lead changes | Drama | Killer move | Comeback | Near-miss | Tension | KOs | Decisiveness |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| smart | 1.00 | 16.2 ± 3.8 | 13.1 ± 3.1 | 0.87 | 0.09 | 0.08 | 0.46 | 12% | 0% | 12% | 0.01 | 0.66 |
| casual | 0.82 | 32.1 ± 6.5 | 23.9 ± 4.9 | 0.38 | 0.12 | 0.11 | 0.41 | 32% | 10% | 38% | 1.65 | 0.45 |
| mash | 0.61 | 31.0 ± 6.6 | 22.8 ± 5.5 | 0.24 | 0.12 | 0.08 | 0.40 | 14% | 19% | 30% | 2.08 | 0.48 |
| random | 0.07 | 35.4 ± 10.6 | 25.6 ± 8.0 | 0.02 | 0.03 | 0.19 | 0.46 | 62% | 31% | 77% | 4.11 | 0.73 |
| attack | 0.75 | 28.2 ± 4.0 | 20.8 ± 3.4 | 0.19 | 0.11 | 0.07 | 0.35 | 11% | 37% | 41% | 1.99 | 0.52 |
| smart-noMech | 1.00 | 15.7 ± 3.4 | 12.7 ± 2.8 | 0.87 | 0.09 | 0.08 | 0.46 | 10% | 0% | 10% | 0.02 | 0.67 |
| casual-noMech | 0.80 | 30.9 ± 7.1 | 22.8 ± 5.4 | 0.39 | 0.11 | 0.10 | 0.41 | 24% | 10% | 31% | 1.63 | 0.51 |
| smart-noTiming | 1.00 | 19.4 ± 3.9 | 15.8 ± 3.3 | 0.85 | 0.10 | 0.10 | 0.47 | 12% | 0% | 12% | 0.04 | 0.60 |

## Chapter 6: The Unspoken Wood

Fun Index 60.7 of 100. Parts: challenge 0.45, tension 0.73, lead 0.30, variety 1.00, relevance 0.00, pacing 0.85, novelty 1.00.

| Measure | Value |
| --- | --- |
| Estimated play time | 18.0 minutes |
| Novelty | 10 new things, 5.6 per 10 minutes |
| Casual walk retries | 1 (0 stuck) |
| Regular fight length | 13.3 actions, 15% party HP lost per fight |

### Boss hush

Party level 21.3 against boss level 23. Attack-only gap 0.26. Mechanic drop 0.0 points, or -1.2 points of final party HP. Timing drop 0.0 points. Smart entropy 1.00, top action attack at 15%. Smart Rewinds per fight 0.10.

| Variant | Win rate | Actions | Party turns | Final HP | Lead changes | Drama | Killer move | Comeback | Near-miss | Tension | KOs | Decisiveness |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| smart | 1.00 | 21.8 ± 5.3 | 18.6 ± 4.5 | 0.93 | 0.06 | 0.08 | 0.47 | 5% | 0% | 5% | 0.00 | 0.74 |
| casual | 0.79 | 42.8 ± 10.0 | 33.2 ± 8.2 | 0.44 | 0.09 | 0.11 | 0.47 | 32% | 8% | 36% | 2.12 | 0.52 |
| mash | 0.54 | 41.6 ± 7.3 | 32.4 ± 6.6 | 0.20 | 0.09 | 0.08 | 0.36 | 17% | 23% | 37% | 2.44 | 0.46 |
| random | 0.00 | 21.7 ± 4.2 | 15.7 ± 3.2 | 0.00 | 0.03 | 0.00 | 0.64 | 0% | 0% | 0% | 4.17 | 0.74 |
| attack | 0.74 | 38.5 ± 3.5 | 30.0 ± 3.4 | 0.23 | 0.09 | 0.06 | 0.28 | 7% | 22% | 26% | 1.96 | 0.51 |
| smart-noMech | 1.00 | 20.5 ± 4.9 | 17.3 ± 4.2 | 0.94 | 0.06 | 0.09 | 0.47 | 4% | 0% | 4% | 0.00 | 0.74 |
| casual-noMech | 0.80 | 39.8 ± 9.5 | 30.8 ± 7.7 | 0.49 | 0.08 | 0.11 | 0.44 | 34% | 4% | 35% | 2.02 | 0.55 |
| smart-noTiming | 1.00 | 27.4 ± 6.3 | 23.3 ± 5.4 | 0.89 | 0.07 | 0.11 | 0.48 | 19% | 0% | 19% | 0.04 | 0.66 |

### Boss linemen

Party level 22.0 against boss level 22. Attack-only gap 0.00. Mechanic drop 0.0 points, or -0.1 points of final party HP. Timing drop 0.0 points. Smart entropy 1.00, top action attack at 22%. Smart Rewinds per fight 0.00.

| Variant | Win rate | Actions | Party turns | Final HP | Lead changes | Drama | Killer move | Comeback | Near-miss | Tension | KOs | Decisiveness |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| smart | 1.00 | 9.3 ± 2.4 | 7.5 ± 1.9 | 0.95 | 0.03 | 0.01 | 0.32 | 0% | 0% | 0% | 0.00 | 0.81 |
| casual | 1.00 | 11.6 ± 3.2 | 8.7 ± 2.2 | 0.93 | 0.03 | 0.02 | 0.29 | 0% | 0% | 0% | 0.01 | 0.85 |
| mash | 1.00 | 12.1 ± 1.1 | 9.3 ± 0.7 | 0.89 | 0.02 | 0.01 | 0.19 | 0% | 0% | 0% | 0.01 | 0.89 |
| random | 0.79 | 42.7 ± 14.4 | 30.5 ± 10.2 | 0.43 | 0.05 | 0.06 | 0.26 | 6% | 4% | 8% | 1.53 | 0.60 |
| attack | 1.00 | 10.4 ± 1.0 | 8.2 ± 0.5 | 0.93 | 0.02 | 0.01 | 0.21 | 0% | 0% | 0% | 0.00 | 0.88 |
| smart-noMech | 1.00 | 9.9 ± 2.2 | 7.9 ± 1.6 | 0.96 | 0.03 | 0.01 | 0.33 | 0% | 0% | 0% | 0.00 | 0.82 |
| casual-noMech | 1.00 | 12.4 ± 3.4 | 9.3 ± 2.3 | 0.92 | 0.03 | 0.01 | 0.28 | 0% | 0% | 0% | 0.03 | 0.86 |
| smart-noTiming | 1.00 | 9.7 ± 2.0 | 7.8 ± 1.6 | 0.93 | 0.04 | 0.02 | 0.29 | 0% | 0% | 0% | 0.00 | 0.80 |

## Chapter 7: The Catch

Fun Index 79.2 of 100. Parts: challenge 0.73, tension 0.98, lead 0.37, variety 1.00, relevance 0.80, pacing 0.61, novelty 1.00.

| Measure | Value |
| --- | --- |
| Estimated play time | 21.4 minutes |
| Novelty | 7 new things, 3.3 per 10 minutes |
| Casual walk retries | 0 (0 stuck) |
| Regular fight length | 16.3 actions, 26% party HP lost per fight |

### Boss sincerely

Party level 25.0 against boss level 24. Attack-only gap 0.96. Mechanic drop 4.0 points, or 0.0 points of final party HP. Timing drop 0.0 points. Smart entropy 1.00, top action line at 12%. Smart Rewinds per fight 0.01.

| Variant | Win rate | Actions | Party turns | Final HP | Lead changes | Drama | Killer move | Comeback | Near-miss | Tension | KOs | Decisiveness |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| smart | 1.00 | 14.0 ± 3.0 | 11.7 ± 2.5 | 0.98 | 0.07 | 0.08 | 0.44 | 0% | 0% | 0% | 0.00 | 0.70 |
| casual | 0.67 | 38.8 ± 8.9 | 29.2 ± 6.0 | 0.23 | 0.07 | 0.07 | 0.32 | 1% | 26% | 26% | 2.36 | 0.48 |
| mash | 0.00 | 41.7 ± 2.9 | 31.5 ± 2.2 | 0.00 | 0.06 | 0.00 | 0.30 | 0% | 0% | 0% | 4.00 | 0.46 |
| random | 0.15 | 49.9 ± 10.2 | 39.0 ± 8.3 | 0.08 | 0.04 | 0.12 | 0.38 | 42% | 29% | 45% | 3.77 | 0.60 |
| attack | 0.04 | 44.3 ± 2.8 | 33.3 ± 2.1 | 0.00 | 0.08 | 0.04 | 0.27 | 0% | 100% | 100% | 3.98 | 0.31 |
| smart-noMech | 1.00 | 14.0 ± 3.0 | 11.7 ± 2.5 | 0.98 | 0.07 | 0.08 | 0.44 | 0% | 0% | 0% | 0.00 | 0.70 |
| casual-noMech | 0.63 | 38.0 ± 8.5 | 28.5 ± 5.7 | 0.23 | 0.08 | 0.07 | 0.32 | 0% | 26% | 26% | 2.42 | 0.47 |
| smart-noTiming | 1.00 | 15.3 ± 3.0 | 12.7 ± 2.6 | 0.98 | 0.06 | 0.08 | 0.45 | 0% | 0% | 0% | 0.01 | 0.72 |

## Chapter 8: The Lonesome Sea

Fun Index 79.1 of 100. Parts: challenge 0.56, tension 0.67, lead 0.29, variety 1.00, relevance 1.00, pacing 1.00, novelty 1.00.

| Measure | Value |
| --- | --- |
| Estimated play time | 23.6 minutes |
| Novelty | 9 new things, 3.8 per 10 minutes |
| Casual walk retries | 1 (0 stuck) |
| Regular fight length | 12.7 actions, 13% party HP lost per fight |

### Boss deadletter

Party level 28.0 against boss level 27. Attack-only gap not applicable because the boss must be answered. Mechanic drop 6.0 points, or -1.4 points of final party HP. Timing drop 0.0 points. Smart entropy 1.00, top action attack at 13%. Smart Rewinds per fight 0.04.

| Variant | Win rate | Actions | Party turns | Final HP | Lead changes | Drama | Killer move | Comeback | Near-miss | Tension | KOs | Decisiveness |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| smart | 1.00 | 22.4 ± 6.2 | 18.9 ± 5.5 | 0.94 | 0.00 | 0.00 | 0.42 | 0% | 0% | 0% | 0.01 | 0.88 |
| casual | 0.81 | 69.1 ± 18.7 | 47.7 ± 11.5 | 0.29 | 0.06 | 0.04 | 0.31 | 6% | 12% | 17% | 2.17 | 0.52 |
| mash | 0.00 | 87.9 ± 26.0 | 55.9 ± 17.6 | 0.01 | 0.10 | 0.00 | 0.31 | 0% | 0% | 0% | 4.74 | 0.13 |
| random | 0.00 | 52.9 ± 11.9 | 34.9 ± 8.1 | 0.00 | 0.05 | 0.00 | 0.40 | 0% | 0% | 0% | 4.31 | 0.62 |
| attack | 0.00 | 80.9 ± 53.0 | 56.3 ± 36.2 | 0.02 | 0.07 | 0.00 | 0.28 | 0% | 0% | 0% | 3.67 | 0.33 |
| smart-noMech | 0.99 | 24.2 ± 14.6 | 20.4 ± 12.2 | 0.96 | 0.00 | 0.00 | 0.42 | 0% | 0% | 0% | 0.00 | 0.89 |
| casual-noMech | 0.74 | 73.8 ± 17.2 | 50.4 ± 10.4 | 0.28 | 0.07 | 0.04 | 0.32 | 2% | 13% | 14% | 2.50 | 0.46 |
| smart-noTiming | 1.00 | 25.9 ± 8.2 | 22.0 ± 7.3 | 0.93 | 0.00 | 0.00 | 0.42 | 0% | 0% | 0% | 0.01 | 0.89 |

## Chapter 9: Amen

Fun Index 79.7 of 100. Parts: challenge 0.53, tension 0.66, lead 0.46, variety 1.00, relevance 1.00, pacing 0.96, novelty 1.00.

| Measure | Value |
| --- | --- |
| Estimated play time | 22.6 minutes |
| Novelty | 7 new things, 3.1 per 10 minutes |
| Casual walk retries | 0 (0 stuck) |
| Regular fight length | 14.4 actions, 9% party HP lost per fight |

### Boss amen1

Party level 31.5 against boss level 31. Attack-only gap not applicable because the boss must be answered. Mechanic drop 1.0 points, or 1.7 points of final party HP. Timing drop 1.5 points. Smart entropy 1.00, top action attack at 8%. Smart Rewinds per fight 0.01.

| Variant | Win rate | Actions | Party turns | Final HP | Lead changes | Drama | Killer move | Comeback | Near-miss | Tension | KOs | Decisiveness |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| smart | 0.99 | 23.7 ± 19.2 | 18.8 ± 16.3 | 0.74 | 0.01 | 0.01 | 0.25 | 0% | 0% | 0% | 0.99 | 0.83 |
| casual | 0.72 | 37.2 ± 13.9 | 23.3 ± 7.9 | 0.26 | 0.08 | 0.05 | 0.29 | 11% | 23% | 26% | 2.71 | 0.45 |
| mash | 0.64 | 46.1 ± 4.3 | 28.7 ± 2.5 | 0.08 | 0.12 | 0.16 | 0.30 | 86% | 72% | 94% | 3.88 | 0.19 |
| random | 0.02 | 53.8 ± 11.3 | 37.4 ± 8.5 | 0.02 | 0.05 | 0.18 | 0.35 | 75% | 25% | 75% | 4.46 | 0.64 |
| attack | 0.29 | 34.1 ± 6.7 | 22.2 ± 4.0 | 0.06 | 0.05 | 0.08 | 0.27 | 8% | 54% | 54% | 3.47 | 0.42 |
| smart-noMech | 0.98 | 25.0 ± 25.9 | 19.5 ± 21.4 | 0.72 | 0.01 | 0.00 | 0.24 | 0% | 0% | 0% | 0.99 | 0.84 |
| casual-noMech | 0.77 | 37.4 ± 14.7 | 23.5 ± 8.4 | 0.30 | 0.07 | 0.05 | 0.30 | 10% | 16% | 20% | 2.47 | 0.49 |
| smart-noTiming | 0.97 | 30.1 ± 27.3 | 23.8 ± 22.2 | 0.72 | 0.02 | 0.01 | 0.24 | 0% | 0% | 0% | 1.02 | 0.81 |

### Boss amen2

Party level 31.5 against boss level 31. Attack-only gap not applicable because the boss must be answered. Mechanic drop 100.0 points, or -7.8 points of final party HP. Timing drop -2.5 points. Smart entropy 1.00, top action attack at 24%. Smart Rewinds per fight 0.02.

| Variant | Win rate | Actions | Party turns | Final HP | Lead changes | Drama | Killer move | Comeback | Near-miss | Tension | KOs | Decisiveness |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| smart | 0.94 | 20.4 ± 47.8 | 16.6 ± 38.8 | 0.92 | 0.17 | 0.06 | 0.80 | 1% | 0% | 1% | 0.00 | 0.42 |
| casual | 1.00 | 28.1 ± 7.7 | 21.3 ± 5.8 | 0.70 | 0.10 | 0.09 | 0.39 | 8% | 0% | 8% | 0.10 | 0.65 |
| mash | 0.00 | 198.3 ± 16.9 | 151.4 ± 13.2 | 0.42 | 0.02 | 0.00 | 0.39 | 0% | 0% | 0% | 1.57 | 0.91 |
| random | 0.74 | 26.6 ± 15.5 | 20.6 ± 11.6 | 0.39 | 0.11 | 0.22 | 0.70 | 63% | 10% | 63% | 2.08 | 0.21 |
| attack | 0.00 | 200.0 ± 0.0 | 147.0 ± 10.5 | 0.35 | 0.01 | 0.00 | 0.32 | 0% | 0% | 0% | 0.43 | 0.96 |
| smart-noMech | 0.00 | 200.0 ± 0.0 | 167.0 ± 2.7 | 1.00 | 0.00 | 0.00 | 0.24 | 0% | 0% | 0% | 0.00 | 0.98 |
| casual-noMech | 0.00 | 200.0 ± 0.0 | 153.0 ± 3.6 | 0.90 | 0.01 | 0.00 | 0.36 | 0% | 0% | 0% | 0.22 | 0.95 |
| smart-noTiming | 0.96 | 17.5 ± 38.7 | 14.3 ± 31.3 | 0.89 | 0.19 | 0.08 | 0.78 | 3% | 0% | 3% | 0.02 | 0.41 |

## Flagged problems

- chapter 1 boss want: smart win rate 0.99, too easy for a skilled player.
- chapter 1 boss want: casual win rate 0.86, too easy.
- chapter 1 boss want: removing the chapter mechanic changes the smart or casual win rate by at most 1.0 points, so the mechanic barely matters.
- chapter 2 boss bigger: smart win rate 1.00, too easy for a skilled player.
- chapter 3 boss supervisor: smart win rate 1.00, too easy for a skilled player.
- chapter 3 boss supervisor: casual win rate 0.86, too easy.
- chapter 3 boss supervisor: smart fights last 19.2 actions, outside the 20 to 45 range.
- chapter 4 boss bedtime: smart win rate 1.00, too easy for a skilled player.
- chapter 4 boss bedtime: casual win rate 0.84, too easy.
- chapter 4 boss bedtime: removing the chapter mechanic changes the smart or casual win rate by at most 4.0 points, so the mechanic barely matters.
- chapter 4 boss bedtime: smart fights last 16.8 actions, outside the 20 to 45 range.
- chapter 5 boss house: smart win rate 1.00, too easy for a skilled player.
- chapter 5 boss house: casual win rate 0.82, too easy.
- chapter 5 boss house: mashing Attack and healing items wins 62% of fights, so the boss needs no tactics.
- chapter 5 boss house: removing the chapter mechanic changes the smart or casual win rate by at most 2.5 points, so the mechanic barely matters.
- chapter 5 boss house: smart fights last 16.2 actions, outside the 20 to 45 range.
- chapter 6 boss hush: smart win rate 1.00, too easy for a skilled player.
- chapter 6 boss hush: mashing Attack and healing items wins 54% of fights, so the boss needs no tactics.
- chapter 6 boss hush: removing the chapter mechanic changes the smart or casual win rate by at most 0.0 points, so the mechanic barely matters.
- chapter 6 boss linemen: smart win rate 1.00, too easy for a skilled player.
- chapter 6 boss linemen: casual win rate 1.00, too easy.
- chapter 6 boss linemen: mashing Attack and healing items wins 100% of fights, so the boss needs no tactics.
- chapter 6 boss linemen: random play wins 79% of fights, too easy a floor.
- chapter 6 boss linemen: an attack-only strategy wins 100% against 100% for smart play, so attacking dominates.
- chapter 6 boss linemen: removing the chapter mechanic changes the smart or casual win rate by at most 0.0 points, so the mechanic barely matters.
- chapter 6 boss linemen: smart fights last 9.3 actions, outside the 20 to 45 range.
- chapter 7 boss sincerely: smart win rate 1.00, too easy for a skilled player.
- chapter 7 boss sincerely: removing the chapter mechanic changes the smart or casual win rate by at most 4.0 points, so the mechanic barely matters.
- chapter 7 boss sincerely: smart fights last 14.0 actions, outside the 20 to 45 range.
- chapter 7: regular fights last 16.3 actions on average, outside the 6 to 14 range.
- chapter 8 boss deadletter: smart win rate 1.00, too easy for a skilled player.
- chapter 8 boss deadletter: casual win rate 0.81, too easy.
- chapter 9 boss amen1: smart win rate 0.99, too easy for a skilled player.
- chapter 9 boss amen1: mashing Attack and healing items wins 64% of fights, so the boss needs no tactics.
- chapter 9 boss amen1: removing the chapter mechanic changes the smart or casual win rate by at most 1.0 points, so the mechanic barely matters.
- chapter 9 boss amen2: casual win rate 1.00, too easy.
- chapter 9 boss amen2: random play wins 74% of fights, too easy a floor.
- chapter 9: regular fights last 14.4 actions on average, outside the 6 to 14 range.
- chapter 9: regular fights cost the casual party only 9% of its HP on average, too easy.
