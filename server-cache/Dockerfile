# Create image based on the official Node 6 image from dockerhub
FROM node:8

# Create a directory where our app will be placed
RUN mkdir -p /usr/src/app/server-cache
RUN mkdir -p /usr/src/app/shared

# Change directory so that our commands run inside this new directory
WORKDIR /usr/src/app/server-cache

# Copy dependency definitions
COPY /server-cache/package.json /usr/src/app/server-cache

# Install dependecies
RUN npm install

# Get all the code needed to run the app
COPY /server-cache /usr/src/app/server-cache
COPY /shared /usr/src/app/shared

# Expose the port the app runs in
EXPOSE 3001

# Serve the app
CMD ["npm", "start"]