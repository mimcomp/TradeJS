# Create image based on the official Node 6 image from dockerhub
FROM node:8

# Create a directory where our app will be placed
RUN mkdir -p /usr/src/app/client
RUN mkdir -p /usr/src/app/shared

# Change directory so that our commands run inside this new directory
WORKDIR /usr/src/app/client

# Copy dependency definitions
COPY /client/package.json /usr/src/app/client

# Install dependecies
RUN npm install

# Get all the code needed to run the app
COPY /client /usr/src/app/client

# Copy over shared folder
# TODO: Refactor
COPY /shared/ /usr/src/app/shared

# Expose the port the app runs in
EXPOSE 4200

# Serve the app
CMD ["npm", "start"]