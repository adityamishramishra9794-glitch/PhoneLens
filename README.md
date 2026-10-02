PhoneLens

PhoneLens is a web application for working with phone-number information from publicly available data sources.

Requirements

- Git
- Node.js
- npm
- Internet connection

Supported on:

- Linux
- Termux
- Windows
- macOS

Clone

git clone https://github.com/adityamishramishra9794-glitch/PhoneLens.git
cd PhoneLens

Install

cd backend
npm install

Configure

Set required API keys as environment variables.

export TAVILY_API_KEY="YOUR_API_KEY"

Never commit API keys, passwords, tokens, or ".env" files to the repository.

Run

npm start

If "npm start" is unavailable:

node server.js

The backend runs on:

http://localhost:3000

Termux

pkg update
pkg install git nodejs
git clone https://github.com/adityamishramishra9794-glitch/PhoneLens.git
cd PhoneLens/backend
npm install
npm start

Use

PhoneLens is intended for lawful use with publicly available information. Do not use it to access private, restricted, leaked, or unauthorized data.
