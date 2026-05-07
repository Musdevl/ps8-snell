# Front-end

## Pages

### Auth
Two pages: **login** and **register**. The forgot password is a multi-step flow to test their honesty.

### Home
The home page is the main hub after login. The **shop** lives here directly, so users can browse themes and buy Snell Coins without leaving. The **social bar** is also embedded here, letting users interact with friends and check the leaderboard without navigating away.

### Game
Each mode gets its own page, all sharing a common component and style:
- **Local** — two players on the same device
- **AI** — against the bot
- **Multiplayer** — online, with a waiting room before the match
- **Review** — replay a finished game with AI analysis
- **Tutorial** — learn the rules interactively

### Profile
Shows the user's stats, inventory and achievements. The **social bar** is also present here, giving access to friend interactions and the leaderboard in context.

---   


We avoided multiplying pages, features that didn't need their own URL (like the shop or the social bar) are embedded directly where they're used.

## Components

The heaviest one is `board`, which renders the grid, pieces, laser paths and interactions. It's internally split into sub-renderers (grid, pieces, laser, interactions) to keep each concern manageable. It's used across all game pages, the review and the tutorial.

Around the board, `player-info` shows each player's name, inventory and rotation controls, while `end-message` displays the win/loss/draw overlay when the game ends. 

The `evaluation-bar` gives a live advantage indicator in game review, and `review-analytics` handles move-by-move playback and analysis on the review page.

### Social Bar
`social-bar` appears on the home page and the profile page. It lets users send duel requests to friends, visit their profiles, and browse the leaderboard. It also doubles as a navigation aid, linking to the different sections of the site.

### Chat
The global chat, friend chat and in-game chat are all instances of the same `chat` component. The underlying logic is identical — the component is simply connected to a different `chatId` depending on the context: a global channel, a friendship ID, or a game session ID.

### Nav Bar (mobile)
On mobile layouts, a `nav-bar` component is rendered at the bottom of the screen for easier thumb access. It covers the main site sections and includes a notification badge on the social entry point, indicating pending friend requests.

We also have components used across many pages like `notification` that, depending on the context, can display things differently.

### What could be improved
Even though we put effort into componentising the game, the three game pages (local, AI, multiplayer) still feel repetitive — the structure and logic are very similar across all three. We could have pushed the abstraction further to avoid that duplication.