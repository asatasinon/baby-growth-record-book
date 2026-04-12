from app.core.logging import configure_logging
from app.runner import run_forever


def main() -> None:
    configure_logging()
    run_forever()


if __name__ == "__main__":
    main()
