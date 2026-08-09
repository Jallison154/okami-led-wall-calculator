# LED Video Wall Calculator — fully client-side (math + canvas + jsPDF). No Node backend.
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY . /usr/share/nginx/html
RUN rm -rf /usr/share/nginx/html/.git
EXPOSE 80
