from abc import ABC, abstractmethod
from typing import Dict, Any

class JobProcessor(ABC):
    name: str

    @abstractmethod
    def process(self, job_input: Dict[str, Any]) -> Dict[str, Any]:
        """
        Takes validated input and returns structured output.
        """
        pass
