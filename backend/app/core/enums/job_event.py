from enum import Enum

class JobEvent(str, Enum):
    SUCCESS = "SUCCESS"
    FAILURE = "FAILURE"
