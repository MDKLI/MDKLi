import logging

def get_logger(name: str = __name__) -> logging.Logger:
    logger = logging.getLogger(name)

    if not logger.handlers:
        handler = logging.StreamHandler()

        formatter = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        )

        handler.setFormatter(formatter)
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)

    return logger



# in the future instead of
# def get_logger(name: str)
# we can use
# def get_logger(name: str = __name__):
# then not have to pass __name__ every time we call get_logger, but this is a design choice.