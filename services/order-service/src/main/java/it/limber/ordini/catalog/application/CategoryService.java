package it.limber.ordini.catalog.application;

import it.limber.ordini.catalog.domain.Category;
import it.limber.ordini.catalog.domain.CategoryRepository;
import it.limber.ordini.shared.error.BusinessRuleException;
import it.limber.ordini.shared.error.ConflictException;
import it.limber.ordini.shared.error.NotFoundException;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class CategoryService {

	public record CategoryCommand(String name, UUID parentId) {
	}

	public record CategoryView(UUID id, String name, UUID parentId) {

		static CategoryView of(Category category) {
			return new CategoryView(category.getId(), category.getName(),
					category.getParent() == null ? null : category.getParent().getId());
		}

	}

	private final CategoryRepository categories;

	public CategoryService(CategoryRepository categories) {
		this.categories = categories;
	}

	@Transactional(readOnly = true)
	public List<CategoryView> list() {
		return categories.findAll(Sort.by("name")).stream().map(CategoryView::of).toList();
	}

	@Transactional
	public CategoryView create(CategoryCommand command) {
		String name = command.name().trim();
		if (categories.existsByNameIgnoreCase(name)) {
			throw new ConflictException("Esiste già una categoria chiamata " + name);
		}
		Category category = new Category(name, resolveParent(command.parentId()));
		return CategoryView.of(categories.save(category));
	}

	@Transactional
	public CategoryView update(UUID id, CategoryCommand command) {
		Category category = categories.findById(id)
			.orElseThrow(() -> new NotFoundException("Categoria non trovata: " + id));
		String name = command.name().trim();
		if (categories.existsByNameIgnoreCaseAndIdNot(name, id)) {
			throw new ConflictException("Esiste già una categoria chiamata " + name);
		}
		Category parent = resolveParent(command.parentId());
		if (parent != null && parent.isSameOrDescendantOf(category)) {
			throw new BusinessRuleException("Una categoria non può essere figlia di se stessa o di una sua discendente");
		}
		category.update(name, parent);
		categories.flush();
		return CategoryView.of(category);
	}

	private Category resolveParent(UUID parentId) {
		if (parentId == null) {
			return null;
		}
		return categories.findById(parentId)
			.orElseThrow(() -> new BusinessRuleException("La categoria padre non esiste: " + parentId));
	}

}
