# Simple Nginx static server for frontend
FROM nginx:1.25-alpine
COPY ./public /usr/share/nginx/html/frontend/public
COPY ./pages /usr/share/nginx/html/frontend/pages
COPY ./nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
