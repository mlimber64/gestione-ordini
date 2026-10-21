package it.limber.notification.event;

/**
 * Messaggio che non si potrà mai elaborare (JSON illeggibile, campi mancanti). Ritentare è inutile: va dritto al
 * topic dead-letter.
 */
public class InvalidEventException extends RuntimeException {

	public InvalidEventException(String message, Throwable cause) {
		super(message, cause);
	}

	public InvalidEventException(String message) {
		super(message);
	}

}
