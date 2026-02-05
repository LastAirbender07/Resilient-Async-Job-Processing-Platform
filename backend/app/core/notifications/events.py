from enum import Enum

class JobEvent(str, Enum): 
    """ 
    Canonical job lifecycle events that can trigger notifications. 
    This enum is intentionally minimal. Expansion requires explicit design approval. 
    """ 
    SUCCESS = "SUCCESS" 
    FAILURE = "FAILURE"
    