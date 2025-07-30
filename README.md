# ReelSensei

ReelSensei is a comprehensive automation tool designed to interact with Instagram. It leverages a Node.js backend to control an Android emulator, enabling functionalities such as logging in, navigating profiles, and posting comments. The project is containerized using Docker, ensuring a consistent and reproducible environment across different machines.

## Key Technologies

- **Node.js**: Powers the backend application, orchestrating the automation tasks.
- **TypeScript**: Provides static typing for robust and maintainable code.
- **Docker & Docker Compose**: Containerizes the application and its dependencies.
- **WebdriverIO**: Facilitates communication with the Appium server to control the Android emulator.
- **Appium**: An open-source tool for automating mobile applications.
- **PostgreSQL**: Serves as the database for storing application data.

## Services

The `docker-compose.yml` file defines the following services:

- **`postgres`**: A PostgreSQL database instance for data storage.
- **`android`**: A container running an Android emulator (`budtmo/docker-android`) with Appium, enabling mobile automation.
- **`app`**: The main Node.js application that controls the automation workflow.

## Getting Started

To run the project, ensure you have Docker and Docker Compose installed, then execute the following command from the project root:

```bash
docker-compose up --build
```

This command will build the application image, pull the required service images, and start all containers.

- The main application will be available on port `5000`.
- You can monitor the emulator's screen via VNC in your browser at `http://localhost:6080/`. Note that the VNC service in this Docker image can be unstable.
