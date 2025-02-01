FROM oven/bun:latest

COPY package.json ./
COPY bun.lockb ./
COPY index.ts ./

RUN bun install --frozen-lockfile --production

ENV NODE_ENV=production

USER bun
EXPOSE 4000/tcp
ENTRYPOINT [ "bun", "run", "./index.ts" ]
