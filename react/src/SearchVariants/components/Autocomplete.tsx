import React, { useMemo, useState } from "react";
import {
    CircularProgress,
    IconButton,
    Menu,
    MenuItem,
    OutlinedInput,
    useTheme,
} from "@material-ui/core";
import { Menu as MenuIcon, Search } from "@material-ui/icons";
import { Autocomplete } from "@material-ui/lab";
import { snakeCaseToTitle } from "../../functions";
import { useGenesQuery } from "../../hooks/genes";
import { GeneAlias } from "../../typings";

type SearchCategory = "gene" | "region" | "variant_position" | "rsld";
const searchCategoryList: SearchCategory[] = ["gene", "region", "variant_position", "rsld"];

interface GeneAutocompleteProps {
    fullWidth?: boolean;
    onSearch?: () => void;
    onSelect: (result: GeneAlias) => void;
}

interface SearchCategorySelectProps {
    value: SearchCategory;
    onSelect: (value: SearchCategory) => void;
}

function SearchCategorySelect(props: SearchCategorySelectProps) {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

    return (
        <>
            <IconButton size="small" onClick={event => setAnchorEl(event.currentTarget)}>
                <MenuIcon />
            </IconButton>
            <Menu
                transformOrigin={{ horizontal: "left", vertical: "top" }}
                anchorEl={anchorEl}
                keepMounted
                open={!!anchorEl}
                onClose={() => setAnchorEl(null)}
            >
                {searchCategoryList.map(category => (
                    <MenuItem
                        key={category}
                        onClick={() => {
                            props.onSelect(category);
                            setAnchorEl(null);
                        }}
                        selected={props.value === category}
                    >
                        {"Search by " + snakeCaseToTitle(category)}
                    </MenuItem>
                ))}
            </Menu>
        </>
    );
}

const GeneAutocomplete: React.FC<GeneAutocompleteProps> = ({ fullWidth, onSearch, onSelect }) => {
    const [search, setSearch] = useState<string>("");
    const [selectedValue, setSelectedValue] = useState<GeneAlias>();
    const [searchCategory, setSearchCategory] = useState<SearchCategory>("gene");

    const placeholderText = useMemo(() => {
        switch (searchCategory) {
            case "gene":
                return "Search by Gene Name (eg. APOE, VEGFA)";
            case "region":
                return "Search by Region";
            case "variant_position":
                return "Search by Variant Position";
            case "rsld":
                return "Search by RSLD";
            default:
                console.error("Unexpected search category");
                return "";
        }
    }, [searchCategory]);

    // TODO: add searchCategory to params once backend is updated to support other search categories
    const { data: results, isFetching } = useGenesQuery(
        {
            search,
        },
        search.length > 2
    );

    const theme = useTheme();

    return (
        <Autocomplete
            autoComplete
            clearOnEscape
            fullWidth={fullWidth}
            getOptionSelected={(option, value) => option.ensembl_id === value.ensembl_id}
            getOptionLabel={option => option.name || ""}
            includeInputInList={true}
            inputValue={search}
            loading={isFetching}
            noOptionsText="No Results"
            options={results?.data.filter(d => d.name) || []}
            onInputChange={(event, newInputValue, reason) => {
                if (reason === "reset") {
                    setSearch("");
                } else if (reason === "input") {
                    setSearch(newInputValue);
                    if (onSearch) {
                        onSearch();
                    }
                }
            }}
            onChange={(event, selectedValue, reason) => {
                if (search && reason !== "clear" && selectedValue) {
                    onSelect(selectedValue);
                    //persisting selected value will lead to option mismatch warnings
                    setSelectedValue(undefined);
                }
            }}
            renderInput={params => {
                const { InputLabelProps, InputProps, ...rest } = params;
                return (
                    <OutlinedInput
                        placeholder={placeholderText}
                        {...rest}
                        {...InputProps}
                        startAdornment={
                            <Search fontSize="small" htmlColor={theme.palette.grey[600]} />
                        }
                        endAdornment={
                            isFetching ? (
                                <CircularProgress size={16} />
                            ) : (
                                <SearchCategorySelect
                                    value={searchCategory}
                                    onSelect={setSearchCategory}
                                />
                            )
                        }
                    />
                );
            }}
            //we have to control component in order to *prevent* selection persistence
            value={selectedValue || null}
        />
    );
};

export default GeneAutocomplete;
