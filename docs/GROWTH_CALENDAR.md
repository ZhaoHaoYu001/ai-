# Growth Calendar

The growth calendar turns completed speaking sessions into a daily motivation
loop. A day is checked only after the learner finishes a real practice session,
so it records learning activity instead of manual check-in clicks.

## Behavior

- Multiple sessions on one local calendar day create one checked day.
- A session is recorded only after the learner completes at least one answer;
  opening and immediately leaving a scene does not affect streaks or trends.
- A checked day records session count, best score, and spoken words.
- The dashboard shows current streak, active days this month, and total words.
- Up to 180 recent sessions are retained locally for longer-term trends.
- The 30 most recent sessions retain compact per-turn review details: learner
  answers, scores, material corrections, and pronunciation practice tips.
- Learners can open a recent session from the home page and restart the same
  scenario after reviewing its measurable goal.

## Privacy and dependencies

The module uses existing LocalStorage history. It requires no account, network
request, third-party calendar service, or new dependency.

History parsing is defensive so corrupted browser data does not prevent the
application from opening. Older summary-only records remain visible, while new
records support detailed review.
