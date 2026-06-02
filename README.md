<!-- Improved compatibility of back to top link: See: https://github.com/othneildrew/Best-README-Template/pull/73 -->

<a id="readme-top"></a>

<!--
*** Thanks for checking out the Best-README-Template. If you have a suggestion
*** that would make this better, please fork the repo and create a pull request
*** or simply open an issue with the tag "enhancement".
*** Don't forget to give the project a star!
*** Thanks again! Now go create something AMAZING! :D
-->

<!-- PROJECT SHIELDS -->
<!--
*** I'm using markdown "reference style" links for readability.
*** Reference links are enclosed in brackets [ ] instead of parentheses ( ).
*** See the bottom of this document for the declaration of the reference variables
*** for contributors-url, forks-url, etc. This is an optional, concise syntax you may use.
*** https://www.markdownguide.org/basic-syntax/#reference-style-links
-->

<!-- PROJECT LOGO -->
<!-- <br /> -->
<!-- <div align="center"> -->
<!--   <a href="https://github.com/Roverp/dictos"> -->
<!--     <img src="images/logo.png" alt="Logo" width="80" height="80"> -->
<!--   </a> -->

<h3 align="center">Dictos</h3>

  <p align="center">
    A local-first cross-platform personal dictionary. Built for speed, keyboard navigation, and seamless offline-first synchronization across your devices.
    <br />
    <a href="https://github.com/Roverp1/dictos/tree/main/docs/system-overview.md"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <!-- <a href="https://github.com/Roverp/dictos">View Demo</a> -->
    <!-- &middot; -->
    <a href="https://github.com/Roverp/dictos/issues/new?labels=bug&template=bug-report---.md">Report Bug</a>
    &middot;
    <a href="https://github.com/Roverp/dictos/issues/new?labels=enhancement&template=feature-request---.md">Request Feature</a>
  </p>
</div>

<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
    <li><a href="#acknowledgments">Acknowledgments</a></li>
  </ol>
</details>

<!-- ABOUT THE PROJECT -->

## About The Project

I built Dictos because I wanted a fast way to capture notes from reading, organize them, and generate LLM definitions, translations, and examples with LLM's for anki cards.

It runs locally on a Turso database, so it opens instantly and works entirely offline, with optional opt-in synchronization.

Right now, the only client is a Terminal UI. However, work is being done on web client, and mobile is planned for later.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Built With

- [![Bun][Bun.sh]][Bun-url]
- [![React][React.js]][React-url]
- [![Turso][Turso.tech]][Turso-url]
- [![Elysia][Elysiajs.com]][Elysia-url]

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- GETTING STARTED -->

## Getting Started

To get a local copy up and running, follow these steps.

### Prerequisites

You need the Bun runtime installed.

- bun
  ```sh
  curl -fsSL https://bun.sh/install | bash
  ```

### Installation

1. Clone the repo
   ```sh
   git clone https://github.com/Roverp/dictos.git
   cd dictos
   ```
2. Install packages
   ```sh
   bun install
   ```
3. Start the Terminal UI
   ```sh
   bun run dev:tui
   ```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- USAGE EXAMPLES -->

## Usage

Start the app and use your keyboard to navigate. You can create folders, add entries, and manually trigger syncs once you've registered an account.

- `a` to create entry, folder or description
- `d` to delete
- `r` to rename
- `j/k` to move down/up
- `h/l` to go left/right
- `1/2/3` to navigate

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- ROADMAP -->

## Roadmap

- [x] Core dictionary management (Folders, Entries)
- [x] Local SQLite persistence
- [x] Terminal UI
- [x] Cross-device offline-first sync (Turso)
- [ ] Web client
- [ ] LLM-generated descriptions
- [ ] Export to Anki format

See the [open issues](https://github.com/Roverp/dictos/issues) for a full list of proposed features (and known issues).

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTRIBUTING -->

## Contributing

Any contributions are **greatly appreciated**.

Please open an issue, if you unsure about conturibution proccess

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- LICENSE -->

## License

Distributed under the Apache 2.0 License. See `LICENSE.txt` for more information.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTACT -->

## Contact

Yaroslav Gulevsky - [@Roverp](https://github.com/Roverp) - yar.zubaha@proton.me

Project Link: [https://github.com/Roverp/dictos](https://github.com/Roverp/dictos)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- MARKDOWN LINKS & IMAGES -->
<!-- https://www.markdownguide.org/basic-syntax/#reference-style-links -->

[contributors-shield]: https://img.shields.io/github/contributors/Roverp/dictos.svg?style=for-the-badge
[contributors-url]: https://github.com/Roverp/dictos/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/Roverp/dictos.svg?style=for-the-badge
[forks-url]: https://github.com/Roverp/dictos/network/members
[stars-shield]: https://img.shields.io/github/stars/Roverp/dictos.svg?style=for-the-badge
[stars-url]: https://github.com/Roverp/dictos/stargazers
[issues-shield]: https://img.shields.io/github/issues/Roverp/dictos.svg?style=for-the-badge
[issues-url]: https://github.com/Roverp/dictos/issues
[license-shield]: https://img.shields.io/github/license/Roverp/dictos.svg?style=for-the-badge
[license-url]: https://github.com/Roverp/dictos/blob/master/LICENSE.txt

<!-- Shields.io badges. You can a comprehensive list with many more badges at: https://github.com/inttter/md-badges -->

[Bun.sh]: https://img.shields.io/badge/Bun-%23000000.svg?style=for-the-badge&logo=bun&logoColor=white
[Bun-url]: https://bun.sh
[React.js]: https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB
[React-url]: https://reactjs.org/
[Turso.tech]: https://img.shields.io/badge/Turso-4A4A55?style=for-the-badge&logo=turso&logoColor=4FC08D
[Turso-url]: https://turso.tech/
[Elysiajs.com]: https://img.shields.io/badge/Elysia-DD0031?style=for-the-badge&logo=elysia&logoColor=white
[Elysia-url]: https://elysiajs.com/
