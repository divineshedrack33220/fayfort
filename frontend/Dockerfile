FROM node:22-alpine AS deps
WORKDIR /app
RUN npm i -g pnpm@10.34.4
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS build
WORKDIR /app
RUN npm i -g pnpm@10.34.4
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm i -g pnpm@10.34.4
COPY --from=build /app /app
EXPOSE 3000
CMD ["pnpm", "start"]