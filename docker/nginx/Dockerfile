FROM nginx:1.27-alpine

# tiny entrypoint that renders the template with env-vars
RUN apk add --no-cache bash gettext

WORKDIR /etc/nginx

COPY nginx.tmpl /etc/nginx/nginx.tmpl
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]