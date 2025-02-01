FROM oven/bun:latest

COPY package.json ./
COPY bun.lockb ./
COPY index.ts ./

RUN bun install --frozen-lockfile --production

ENV NODE_ENV=production
RUN bun build ./index.ts --compile --target=bun-linux-x64 --minify --sourcemap --bytecode --outfile app

USER bun
EXPOSE 4000/tcp
ENTRYPOINT [ "./app" ]
