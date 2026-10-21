package it.limber.ordini.catalog.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.util.UUID;

@Entity
@Table(name = "category")
public class Category {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(nullable = false, unique = true, length = 80)
	private String name;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "parent_id")
	private Category parent;

	protected Category() {
	}

	public Category(String name, Category parent) {
		update(name, parent);
	}

	public void update(String name, Category parent) {
		this.name = name.trim();
		this.parent = parent;
	}

	/** Vero se questa categoria coincide con {@code other} oppure ne è una discendente. */
	public boolean isSameOrDescendantOf(Category other) {
		for (Category current = this; current != null; current = current.parent) {
			if (current == other || (current.id != null && current.id.equals(other.id))) {
				return true;
			}
		}
		return false;
	}

	public UUID getId() {
		return id;
	}

	public String getName() {
		return name;
	}

	public Category getParent() {
		return parent;
	}

}
