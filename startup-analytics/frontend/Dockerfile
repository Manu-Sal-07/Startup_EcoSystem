# Frontend Dockerfile for the vanilla static frontend
# The frontend is served as static assets through nginx.
FROM node:20-alpine AS build
WORKDIR /app

COPY frontend .
RUN mkdir -p /usr/share/nginx/html/frontend && \
    cp -R . /usr/share/nginx/html/frontend && \
    cp *.html /usr/share/nginx/html/ 2>/dev/null || true

FROM nginx:1.25-alpine AS runtime
RUN apk add --no-cache curl
COPY --from=build /usr/share/nginx/html /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
STOPSIGNAL SIGTERM
CMD ["nginx", "-g", "daemon off;"]
